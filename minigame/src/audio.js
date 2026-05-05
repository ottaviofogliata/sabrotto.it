(function () {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const DEFAULT_MUSIC_GAIN = 0.72;
  const DEFAULT_SFX_GAIN = 0.88;
  const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const NOTE_OFFSETS = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  function parseNote(note) {
    const match = /^([A-G])([b#]?)(\d)$/.exec(note);
    if (!match) throw new Error('Unsupported note: ' + note);
    return match;
  }

  function noteToMidi(note) {
    if (!note) return 0;
    const match = parseNote(note);
    const letter = match[1];
    const accidental = match[2];
    const octave = parseInt(match[3], 10);
    let semitone = NOTE_OFFSETS[letter];
    if (accidental === '#') semitone += 1;
    if (accidental === 'b') semitone -= 1;
    return (octave + 1) * 12 + semitone;
  }

  function midiToNote(midi) {
    const rounded = Math.max(0, Math.round(midi));
    const name = MIDI_NOTE_NAMES[((rounded % 12) + 12) % 12];
    const octave = Math.floor(rounded / 12) - 1;
    return name + octave;
  }

  function transposeNote(note, semitones) {
    return midiToNote(noteToMidi(note) + semitones);
  }

  function noteToFrequency(note) {
    if (!note) return 0;
    const midi = noteToMidi(note);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function normalizeNotes(note) {
    return Array.isArray(note) ? note.slice() : [note];
  }

  function uniqueNotes(notes) {
    const seen = new Set();
    return notes.filter(Boolean).filter(function (note) {
      if (seen.has(note)) return false;
      seen.add(note);
      return true;
    });
  }

  function fitNoteToRange(note, minMidi, maxMidi) {
    let midi = noteToMidi(note);
    while (midi < minMidi) midi += 12;
    while (midi > maxMidi) midi -= 12;
    return midiToNote(midi);
  }

  function pushVoiceEvent(track, voice, step, note, len, velocity) {
    if (step < 0 || step >= track.length || velocity <= 0) return;
    addVoiceNote(track.steps, voice, step, note, len, velocity);
  }

  function pushDrumEvent(track, step, kind, velocity) {
    if (step < 0 || step >= track.length || velocity <= 0) return;
    addDrum(track.steps, step, kind, velocity);
  }

  function createEmptySteps(length) {
    return Array.from({ length: length }, function () {
      return {
        lead: [],
        counter: [],
        harmony: [],
        bass: [],
        tenor: [],
        pad: [],
        choir: [],
        ostinato: [],
        brass: [],
        sub: [],
        shimmer: [],
        drums: [],
      };
    });
  }

  function addVoiceNote(steps, voice, step, note, len, velocity) {
    steps[step][voice].push({
      note: note,
      len: len,
      velocity: velocity,
    });
  }

  function addDrum(steps, step, kind, velocity) {
    steps[step].drums.push({
      kind: kind,
      velocity: velocity,
    });
  }

  function buildTrack(tempo, length, config) {
    const steps = createEmptySteps(length);
    ['lead', 'counter', 'harmony', 'bass', 'tenor', 'pad', 'choir', 'ostinato', 'brass', 'sub', 'shimmer'].forEach(function (voice) {
      (config[voice] || []).forEach(function (entry) {
        addVoiceNote(steps, voice, entry[0], entry[1], entry[2], entry[3]);
      });
    });
    (config.drums || []).forEach(function (entry) {
      addDrum(steps, entry[0], entry[1], entry[2]);
    });
    return {
      tempo: tempo,
      length: length,
      steps: steps,
    };
  }

  function addHatPattern(out, length, every, velocity, start, end) {
    const from = start || 0;
    const until = end == null ? length : end;
    for (let step = from; step < until; step += every) {
      out.push([step, 'hat', velocity]);
    }
  }

  function addBackbeat(out, kicks, snares, kickVelocity, snareVelocity) {
    kicks.forEach(function (step) { out.push([step, 'kick', kickVelocity]); });
    snares.forEach(function (step) { out.push([step, 'snare', snareVelocity]); });
  }

  function offsetEntries(offset, entries) {
    return entries.map(function (entry) {
      return [entry[0] + offset, entry[1], entry[2], entry[3]];
    });
  }

  function mergeEntries() {
    return Array.prototype.concat.apply([], arguments);
  }

  function addOrchestralLayers(track, options) {
    const cfg = Object.assign({
      padVelocity: 0.24,
      tenorVelocity: 0.16,
      choirVelocity: 0.14,
      ostinatoVelocity: 0.13,
      brassVelocity: 0.18,
      subVelocity: 0.14,
      shimmerVelocity: 0.08,
      droneVelocity: 0.12,
      padExtraLen: 4,
      choirEvery: 8,
      tenorEvery: 4,
      droneEvery: 16,
      brassEvery: 8,
      shimmerEvery: 16,
      subEvery: 8,
      upperInterval: 12,
      lowerInterval: -12,
      powerInterval: 7,
      tenorOctave: 12,
      droneOctave: 24,
      lowPadMin: 40,
      lowPadMax: 64,
      brassMin: 55,
      brassMax: 79,
      choirMin: 67,
      choirMax: 88,
      ostinatoMin: 67,
      ostinatoMax: 91,
      subMin: 22,
      subMax: 34,
    }, options || {});

    for (let step = 0; step < track.length; step++) {
      const slot = track.steps[step];

      slot.harmony.forEach(function (event) {
        const chord = uniqueNotes(normalizeNotes(event.note));
        const root = chord[0];
        const third = chord[1] || root;
        const fifth = chord[2] || chord[chord.length - 1] || root;
        const top = chord[chord.length - 1];
        const padChord = uniqueNotes([
          fitNoteToRange(transposeNote(root, cfg.lowerInterval), cfg.lowPadMin - 12, cfg.lowPadMax - 8),
          fitNoteToRange(root, cfg.lowPadMin, cfg.lowPadMax),
          fitNoteToRange(third, cfg.lowPadMin + 3, cfg.lowPadMax + 3),
          fitNoteToRange(fifth, cfg.lowPadMin + 7, cfg.lowPadMax + 7),
          fitNoteToRange(transposeNote(top, cfg.upperInterval), cfg.lowPadMin + 12, cfg.lowPadMax + 12),
        ]);

        pushVoiceEvent(
          track,
          'pad',
          step,
          padChord,
          Math.max(event.len + cfg.padExtraLen, event.len + 2),
          event.velocity * cfg.padVelocity
        );

        if (step % cfg.tenorEvery === 0) {
          pushVoiceEvent(
            track,
            'tenor',
            step,
            uniqueNotes([
              fitNoteToRange(transposeNote(third, cfg.tenorOctave), 52, 67),
              fitNoteToRange(transposeNote(fifth, cfg.tenorOctave), 57, 72),
            ]),
            Math.max(2, Math.min(4, event.len + 1)),
            event.velocity * cfg.tenorVelocity
          );
        }

        if (step % cfg.choirEvery === 0) {
          pushVoiceEvent(
            track,
            'choir',
            step,
            uniqueNotes([
              fitNoteToRange(transposeNote(root, cfg.upperInterval), cfg.choirMin, cfg.choirMax),
              fitNoteToRange(transposeNote(third, cfg.upperInterval), cfg.choirMin + 2, cfg.choirMax),
              fitNoteToRange(transposeNote(fifth, cfg.upperInterval), cfg.choirMin + 5, cfg.choirMax),
              fitNoteToRange(transposeNote(top, cfg.upperInterval + 12), cfg.choirMin + 12, cfg.choirMax + 12),
            ]),
            event.len + 3,
            event.velocity * cfg.choirVelocity
          );
        }

        if (step % cfg.brassEvery === 0) {
          pushVoiceEvent(
            track,
            'brass',
            step,
            uniqueNotes([
              fitNoteToRange(transposeNote(root, cfg.tenorOctave), cfg.brassMin, cfg.brassMax),
              fitNoteToRange(transposeNote(fifth, cfg.tenorOctave), cfg.brassMin + 4, cfg.brassMax),
              fitNoteToRange(transposeNote(root, cfg.droneOctave), cfg.brassMin + 10, cfg.brassMax + 12),
            ]),
            Math.max(2, Math.min(4, event.len)),
            event.velocity * cfg.brassVelocity
          );
        }

        for (let i = 0; i < event.len; i++) {
          const pulsePattern = [
            root,
            fifth,
            third,
            top,
            fifth,
            third,
            root,
            top,
          ];
          const pulseNote = fitNoteToRange(
            transposeNote(pulsePattern[i % pulsePattern.length], cfg.upperInterval),
            cfg.ostinatoMin,
            cfg.ostinatoMax
          );
          pushVoiceEvent(
            track,
            'ostinato',
            step + i,
            pulseNote,
            1,
            event.velocity * cfg.ostinatoVelocity * (i % 2 === 0 ? 1.08 : 0.92)
          );
        }

        if (step % cfg.shimmerEvery === 0) {
          pushVoiceEvent(
            track,
            'shimmer',
            step,
            uniqueNotes([
              fitNoteToRange(transposeNote(top, 24), 84, 98),
              fitNoteToRange(transposeNote(fifth, 24), 81, 96),
            ]),
            Math.max(2, event.len),
            event.velocity * cfg.shimmerVelocity
          );
        }

        if (step % 32 === 0) {
          pushDrumEvent(track, step, 'crash', 0.09);
          pushDrumEvent(track, step + 12, 'tom', 0.1);
          pushDrumEvent(track, step + 14, 'tom', 0.11);
          pushDrumEvent(track, step + 15, 'tom', 0.12);
        } else if (step % 16 === 8) {
          pushDrumEvent(track, step, 'tom', 0.08);
        }
      });

      slot.bass.forEach(function (event) {
        const bassRoot = normalizeNotes(event.note)[0];
        if (step % cfg.droneEvery === 0) {
          pushVoiceEvent(
            track,
            'choir',
            step,
            uniqueNotes([
              fitNoteToRange(transposeNote(bassRoot, cfg.tenorOctave), 55, 72),
              fitNoteToRange(transposeNote(bassRoot, cfg.droneOctave), 67, 84),
            ]),
            Math.max(4, event.len + 2),
            event.velocity * cfg.droneVelocity
          );
        }
        if (step % cfg.subEvery === 0) {
          pushVoiceEvent(
            track,
            'sub',
            step,
            fitNoteToRange(transposeNote(bassRoot, -12), cfg.subMin, cfg.subMax),
            Math.max(3, event.len + 1),
            event.velocity * cfg.subVelocity
          );
        }
      });
    }

    return track;
  }

  /* Helper: espande un mini-DSL "step:note:len:vel" in entries.
     Esempio: "0:D5:2:0.18 4:F5:2:0.18" → [[0,'D5',2,0.18], [4,'F5',2,0.18]]. */
  function E(str) {
    return str.trim().split(/\s+/).map(function (tok) {
      const parts = tok.split(':');
      const len = parts[2] === '_' ? 2 : parseInt(parts[2], 10);
      const vel = parts[3] ? parseFloat(parts[3]) : 0.18;
      return [parseInt(parts[0], 10), parts[1], len, vel];
    });
  }

  /* Helper: espande accordo "step:NOTE1+NOTE2+...:len:vel" */
  function C(str) {
    return str.trim().split(/\s+/).map(function (tok) {
      const parts = tok.split(':');
      const notes = parts[1].split('+');
      const len = parseInt(parts[2], 10);
      const vel = parts[3] ? parseFloat(parts[3]) : 0.1;
      return [parseInt(parts[0], 10), notes, len, vel];
    });
  }

  function makeSunriseTrack() {
    /* "ALBA EROICA" — D minor heroic theme, à la LOTR Fellowship.
       16 bars (256 step). A: Dm-Bb-F-C | Dm-Gm-A-Dm.
       B: F-Am-Bb-Gm | F-C-A7-Dm (relativa maggiore + ritorno). */
    const drums = [];
    // marcia: kick su 1+3, snare su 2+4, hat ogni 2 step, fill toms ogni 32
    [0,8,16,24,32,40,48,56,64,72,80,88,96,104,112,120,
     128,136,144,152,160,168,176,184,192,200,208,216,224,232,240,248].forEach(function (s) {
      drums.push([s, 'kick', s < 128 ? 0.30 : 0.32]);
    });
    [4,12,20,28,36,44,52,60,68,76,84,92,100,108,116,124,
     132,140,148,156,164,172,180,188,196,204,212,220,228,236,244,252].forEach(function (s) {
      drums.push([s, 'snare', s < 128 ? 0.20 : 0.22]);
    });
    addHatPattern(drums, 256, 2, 0.10);
    drums.push([0,'crash',0.28],[64,'crash',0.22],[96,'crash',0.20]);
    drums.push([128,'crash',0.30],[192,'crash',0.24],[240,'crash',0.26]);
    drums.push([62,'tom',0.18],[63,'tom',0.20],[126,'tom',0.20],[127,'tom',0.22]);
    drums.push([190,'tom',0.20],[191,'tom',0.22],[254,'tom',0.24],[255,'tom',0.28]);
    return buildTrack(132, 256, {
      // Tema eroico: motivo dotato che sale e poi rientra.
      lead: E(
        // === SECTION A — D minor heroic ===
        // Bar 1 — Dm
        '0:D5:2:0.20  2:F5:2:0.20  4:A5:4:0.22  8:A5:2:0.20  10:G5:2:0.20  12:F5:2:0.20  14:D5:2:0.20 ' +
        // Bar 2 — Bb (rilancio)
        '16:Bb5:2:0.20  18:A5:2:0.20  20:F5:2:0.20  22:D5:2:0.20  24:F5:2:0.20  26:G5:2:0.20  28:A5:4:0.22 ' +
        // Bar 3 — F (sale)
        '32:F5:2:0.21  34:A5:2:0.21  36:C6:4:0.23  40:F6:4:0.26  44:E6:4:0.24 ' +
        // Bar 4 — C (apice)
        '48:E6:2:0.23  50:D6:2:0.23  52:C6:2:0.22  54:G5:2:0.21  56:E6:4:0.24  60:D6:4:0.23 ' +
        // Bar 5 — Dm (riprende, alto)
        '64:D6:2:0.22  66:F6:2:0.23  68:A6:4:0.27  72:G6:2:0.25  74:F6:2:0.24  76:E6:4:0.23 ' +
        // Bar 6 — Gm (chiama in basso)
        '80:G6:2:0.24  82:F6:2:0.23  84:D6:2:0.22  86:Bb5:2:0.21  88:D6:4:0.23  92:Bb5:4:0.22 ' +
        // Bar 7 — A (tensione)
        '96:A5:2:0.22  98:C#6:2:0.23  100:E6:2:0.23  102:C#6:2:0.22  104:E6:4:0.24  108:A5:4:0.22 ' +
        // Bar 8 — Dm (chiusura epica)
        '112:D6:2:0.23  114:F6:2:0.24  116:A6:4:0.27  120:G6:2:0.25  122:F6:2:0.24  124:D6:4:0.23 ' +
        // === SECTION B — F maggiore (relativa) → ritorno a D minore ===
        // Bar 9 — F (lirico, hopeful)
        '128:C6:2:0.20  130:D6:2:0.21  132:F6:4:0.24  136:E6:2:0.22  138:D6:2:0.21  140:C6:2:0.21  142:A5:2:0.20 ' +
        // Bar 10 — Am (minor pull)
        '144:A5:2:0.21  146:C6:2:0.22  148:E6:2:0.23  150:A6:4:0.27  154:G6:2:0.25  156:F6:4:0.24 ' +
        // Bar 11 — Bb (build)
        '160:Bb5:2:0.22  162:D6:2:0.23  164:F6:2:0.24  166:Bb6:4:0.28  170:A6:2:0.26  172:F6:2:0.24  174:D6:2:0.23 ' +
        // Bar 12 — Gm (turn)
        '176:G5:2:0.21  178:Bb5:2:0.22  180:D6:2:0.23  182:G6:4:0.27  186:F6:2:0.25  188:D6:4:0.23 ' +
        // Bar 13 — F (riapre)
        '192:F5:2:0.22  194:A5:2:0.23  196:C6:2:0.24  198:F6:4:0.27  202:E6:2:0.25  204:D6:2:0.24  206:C6:2:0.23 ' +
        // Bar 14 — C (preparazione)
        '208:G5:2:0.22  210:C6:2:0.23  212:E6:2:0.24  214:G6:4:0.27  218:F6:2:0.26  220:E6:2:0.25  222:D6:2:0.24 ' +
        // Bar 15 — A7 (dominante!)
        '224:A5:2:0.24  226:C#6:2:0.25  228:E6:2:0.26  230:G6:4:0.30  234:F6:2:0.28  236:E6:2:0.26  238:C#6:2:0.25 ' +
        // Bar 16 — Dm (TRIONFO ottava alta)
        '240:D6:2:0.27  242:F6:2:0.28  244:A6:4:0.32  248:D7:4:0.36  252:A6:2:0.30  254:F6:2:0.28'
      ),
      counter: E(
        // Section A controcanto
        '0:A4:1:0.10  3:D5:1:0.10  5:F5:1:0.10  7:A4:1:0.10  9:D5:1:0.10  11:F5:1:0.11  13:A4:1:0.10  15:D5:1:0.11 ' +
        '17:Bb4:1:0.10  19:D5:1:0.10  21:F5:1:0.11  23:Bb4:1:0.10  25:D5:1:0.10  27:A4:1:0.10  29:F5:1:0.11  31:A5:1:0.11 ' +
        '33:C5:1:0.11  35:F5:1:0.11  37:A5:1:0.12  39:C6:1:0.12  41:F5:1:0.11  43:A5:1:0.12  45:C6:1:0.12  47:F6:1:0.13 ' +
        '49:G5:1:0.11  51:E5:1:0.10  53:G5:1:0.11  55:C6:1:0.12  57:E6:1:0.13  59:G5:1:0.11  61:C6:1:0.12  63:E6:1:0.13 ' +
        '65:A4:1:0.10  67:D5:1:0.11  69:F5:1:0.11  71:A5:1:0.12  73:D6:1:0.13  75:A5:1:0.12  77:F5:1:0.11  79:A5:1:0.12 ' +
        '81:G4:1:0.10  83:Bb4:1:0.10  85:D5:1:0.11  87:G5:1:0.11  89:Bb5:1:0.12  91:D6:1:0.13  93:Bb5:1:0.12  95:D5:1:0.11 ' +
        '97:E5:1:0.10  99:A5:1:0.12  101:C#6:1:0.12  103:E6:1:0.13  105:A5:1:0.12  107:C#6:1:0.12  109:E5:1:0.10  111:A4:1:0.10 ' +
        '113:F5:1:0.11  115:A5:1:0.12  117:D6:1:0.13  119:F6:1:0.14  121:A5:1:0.12  123:D6:1:0.13  125:F6:1:0.14  127:D6:1:0.13 ' +
        // Section B controcanto (più melodico, terze e seste)
        '129:F5:1:0.11  131:A5:1:0.12  133:C6:1:0.13  135:F6:1:0.14  137:A5:1:0.12  139:C6:1:0.13  141:F5:1:0.11  143:A5:1:0.12 ' +
        '145:C6:1:0.13  147:E6:1:0.14  149:A6:1:0.16  151:E6:1:0.14  153:C6:1:0.13  155:A5:1:0.12  157:E6:1:0.14  159:C6:1:0.13 ' +
        '161:F5:1:0.12  163:Bb5:1:0.13  165:D6:1:0.14  167:F6:1:0.15  169:Bb5:1:0.13  171:D6:1:0.14  173:Bb5:1:0.13  175:F5:1:0.12 ' +
        '177:G5:1:0.12  179:Bb5:1:0.13  181:D6:1:0.14  183:G6:1:0.16  185:Bb5:1:0.13  187:D6:1:0.14  189:F5:1:0.12  191:Bb5:1:0.13 ' +
        '193:A5:1:0.13  195:C6:1:0.14  197:F6:1:0.15  199:A6:1:0.17  201:F6:1:0.15  203:C6:1:0.14  205:A5:1:0.13  207:F5:1:0.12 ' +
        '209:G5:1:0.13  211:C6:1:0.14  213:E6:1:0.15  215:G6:1:0.17  217:E6:1:0.15  219:C6:1:0.14  221:G5:1:0.13  223:E6:1:0.15 ' +
        '225:A5:1:0.14  227:C#6:1:0.15  229:E6:1:0.16  231:G6:1:0.18  233:E6:1:0.16  235:C#6:1:0.15  237:A5:1:0.14  239:G6:1:0.18 ' +
        '241:D6:1:0.16  243:F6:1:0.17  245:A6:1:0.20  247:D7:1:0.24  249:A6:1:0.20  251:F6:1:0.17  253:A6:1:0.20  255:D7:1:0.26'
      ),
      harmony: C(
        // Section A
        '0:D4+F4+A4:8:0.13  8:D4+F4+A4:8:0.13 ' +
        '16:Bb3+D4+F4:8:0.13  24:Bb3+D4+F4:8:0.13 ' +
        '32:F3+A3+C4:8:0.13  40:F3+A3+C4:8:0.13 ' +
        '48:C4+E4+G4:8:0.13  56:C4+E4+G4:8:0.13 ' +
        '64:D4+F4+A4:8:0.14  72:D4+F4+A4:8:0.14 ' +
        '80:G3+Bb3+D4:8:0.13  88:G3+Bb3+D4:8:0.13 ' +
        '96:A3+C#4+E4:8:0.13  104:A3+C#4+E4:8:0.14 ' +
        '112:D4+F4+A4:8:0.16  120:D4+F4+A4:8:0.18 ' +
        // Section B (modulazione → ritorno)
        '128:F3+A3+C4:8:0.14  136:F3+A3+C4:8:0.14 ' +
        '144:A3+C4+E4:8:0.14  152:A3+C4+E4:8:0.14 ' +
        '160:Bb3+D4+F4:8:0.15  168:Bb3+D4+F4:8:0.15 ' +
        '176:G3+Bb3+D4:8:0.15  184:G3+Bb3+D4:8:0.16 ' +
        '192:F3+A3+C4:8:0.15  200:F3+A3+C4:8:0.15 ' +
        '208:C4+E4+G4:8:0.16  216:C4+E4+G4:8:0.17 ' +
        '224:A3+C#4+E4+G4:8:0.18  232:A3+C#4+E4+G4:8:0.20 ' +
        '240:D4+F4+A4:8:0.22  248:D4+F4+A4+D5:8:0.26'
      ),
      bass: E(
        // Section A
        '0:D2:2:0.16  2:A2:2:0.15  4:D3:2:0.15  6:A2:2:0.15  8:D2:2:0.16  10:A2:2:0.15  12:F2:2:0.15  14:A2:2:0.15 ' +
        '16:Bb2:2:0.16  18:F2:2:0.15  20:Bb2:2:0.15  22:F2:2:0.15  24:Bb2:2:0.16  26:F2:2:0.15  28:D2:2:0.15  30:F2:2:0.15 ' +
        '32:F2:2:0.16  34:C3:2:0.15  36:F2:2:0.15  38:A2:2:0.15  40:F2:2:0.16  42:C3:2:0.15  44:F3:2:0.15  46:C3:2:0.15 ' +
        '48:C3:2:0.16  50:G2:2:0.15  52:C3:2:0.15  54:G2:2:0.15  56:C3:2:0.16  58:E3:2:0.15  60:G3:2:0.15  62:E3:2:0.15 ' +
        '64:D2:2:0.17  66:A2:2:0.16  68:D3:2:0.16  70:A2:2:0.16  72:D2:2:0.17  74:F2:2:0.16  76:A2:2:0.16  78:D3:2:0.16 ' +
        '80:G2:2:0.17  82:D3:2:0.16  84:G2:2:0.16  86:Bb2:2:0.16  88:G2:2:0.17  90:D3:2:0.16  92:G2:2:0.16  94:Bb2:2:0.16 ' +
        '96:A2:2:0.17  98:E3:2:0.16  100:A2:2:0.16  102:C#3:2:0.16  104:A2:2:0.17  106:E3:2:0.16  108:A2:2:0.16  110:E2:2:0.16 ' +
        '112:D2:2:0.18  114:A2:2:0.17  116:D3:2:0.17  118:A2:2:0.17  120:D2:2:0.18  122:F2:2:0.17  124:A2:2:0.17  126:D3:2:0.18 ' +
        // Section B
        '128:F2:2:0.18  130:C3:2:0.17  132:F2:2:0.17  134:A2:2:0.17  136:F2:2:0.18  138:C3:2:0.17  140:F3:2:0.17  142:C3:2:0.17 ' +
        '144:A2:2:0.18  146:E3:2:0.17  148:A2:2:0.17  150:C3:2:0.17  152:A2:2:0.18  154:E3:2:0.17  156:A2:2:0.17  158:E2:2:0.17 ' +
        '160:Bb2:2:0.18  162:F3:2:0.17  164:Bb2:2:0.17  166:D3:2:0.17  168:Bb2:2:0.18  170:F3:2:0.17  172:Bb2:2:0.17  174:F3:2:0.17 ' +
        '176:G2:2:0.18  178:D3:2:0.17  180:G2:2:0.17  182:Bb2:2:0.17  184:G2:2:0.18  186:D3:2:0.17  188:G2:2:0.17  190:D3:2:0.17 ' +
        '192:F2:2:0.19  194:C3:2:0.18  196:F2:2:0.18  198:A2:2:0.18  200:F2:2:0.19  202:C3:2:0.18  204:F3:2:0.18  206:C3:2:0.18 ' +
        '208:C3:2:0.19  210:G2:2:0.18  212:C3:2:0.18  214:E3:2:0.18  216:C3:2:0.19  218:G2:2:0.18  220:C3:2:0.18  222:G3:2:0.18 ' +
        '224:A2:2:0.20  226:E3:2:0.19  228:A2:2:0.19  230:C#3:2:0.19  232:A2:2:0.20  234:E3:2:0.19  236:G3:2:0.19  238:E3:2:0.19 ' +
        '240:D2:2:0.22  242:A2:2:0.20  244:D3:2:0.21  246:A2:2:0.20  248:D2:2:0.24  250:F2:2:0.22  252:A2:2:0.22  254:D3:2:0.26'
      ),
      drums: drums,
    });
  }

  function makeSunsetTrack() {
    /* "MARCIA DELLA PROVA" — D minor militare, à la Imperial March / Duel of the Fates.
       16 bars (256 step). A: Dm-Bb-A-Dm | Dm-Gm-A-Dm.
       B: Gm-Eb-Bb-D7 | Gm-Cm-A7-Dm (modulazione minore + chromatic). */
    const drums = [];
    const kicks = [];
    const snares = [];
    for (let s = 0; s < 256; s += 4) kicks.push(s);
    for (let s = 2; s < 256; s += 4) snares.push(s);
    kicks.forEach(function (s) { drums.push([s, 'kick', s < 128 ? 0.32 : 0.34]); });
    snares.forEach(function (s) { drums.push([s, 'snare', s < 128 ? 0.20 : 0.22]); });
    addHatPattern(drums, 256, 2, 0.08);
    drums.push([0,'crash',0.30],[64,'crash',0.26],[96,'crash',0.22]);
    drums.push([128,'crash',0.32],[192,'crash',0.30],[240,'crash',0.34]);
    drums.push([62,'tom',0.20],[63,'tom',0.24],[126,'tom',0.22],[127,'tom',0.26]);
    drums.push([190,'tom',0.24],[191,'tom',0.28],[254,'tom',0.30],[255,'tom',0.36]);
    return buildTrack(148, 256, {
      // Motivo "imperiale" insistente e dotato
      lead: E(
        // === A: Imperial march ===
        '0:D5:2:0.22  2:D5:2:0.22  4:D5:4:0.24  8:Bb4:2:0.20  10:A4:2:0.20  12:G4:2:0.20  14:F4:2:0.20 ' +
        '16:Bb4:2:0.21  18:F5:2:0.22  20:E5:2:0.21  22:Eb5:2:0.21  24:D5:4:0.23  28:Bb4:4:0.21 ' +
        '32:A4:2:0.21  34:E5:2:0.22  36:F5:2:0.23  38:E5:2:0.22  40:D5:2:0.21  42:C#5:2:0.21  44:D5:4:0.23 ' +
        '48:F5:2:0.23  50:E5:2:0.22  52:D5:2:0.22  54:C5:2:0.21  56:D5:4:0.24  60:A4:4:0.22 ' +
        '64:D6:2:0.25  66:D6:2:0.25  68:D6:4:0.27  72:Bb5:2:0.24  74:A5:2:0.24  76:G5:2:0.23  78:F5:2:0.23 ' +
        '80:G5:2:0.24  82:Bb5:2:0.24  84:D6:2:0.25  86:Bb5:2:0.24  88:G5:2:0.23  90:F5:2:0.23  92:D5:4:0.23 ' +
        '96:E6:2:0.27  98:F6:2:0.28  100:E6:2:0.27  102:D6:2:0.26  104:C#6:4:0.26  108:E6:4:0.27 ' +
        '112:D6:2:0.27  114:F6:2:0.28  116:A6:4:0.30  120:G6:2:0.27  122:F6:2:0.27  124:D6:4:0.26 ' +
        // === B: Counter-attack — Gm chromatic build, then return ===
        // Bar 9 — Gm (nuovo motivo, terzine)
        '128:G5:2:0.24  130:Bb5:2:0.25  132:D6:4:0.28  136:F6:2:0.26  138:Eb6:2:0.25  140:D6:2:0.25  142:Bb5:2:0.24 ' +
        // Bar 10 — Eb (chromatic shift)
        '144:Eb5:2:0.24  146:G5:2:0.25  148:Bb5:2:0.26  150:Eb6:4:0.29  154:D6:2:0.27  156:Bb5:2:0.25  158:G5:2:0.24 ' +
        // Bar 11 — Bb
        '160:Bb5:2:0.26  162:D6:2:0.27  164:F6:2:0.28  166:Bb6:4:0.32  170:A6:2:0.30  172:G6:2:0.28  174:F6:2:0.26 ' +
        // Bar 12 — D7 (dominante della dominante!)
        '176:F#5:2:0.26  178:A5:2:0.27  180:C6:2:0.28  182:F#6:2:0.30  184:A6:4:0.32  188:F#6:2:0.30  190:D6:2:0.28 ' +
        // Bar 13 — Gm (riprende)
        '192:G6:2:0.30  194:Bb6:2:0.32  196:D7:4:0.36  200:C7:2:0.34  202:Bb6:2:0.32  204:G6:2:0.30  206:Eb6:2:0.28 ' +
        // Bar 14 — Cm (modulazione)
        '208:C6:2:0.28  210:Eb6:2:0.30  212:G6:2:0.31  214:C7:2:0.33  216:Bb6:2:0.31  218:G6:2:0.29  220:Eb6:2:0.28  222:C6:2:0.27 ' +
        // Bar 15 — A7 (preparazione finale)
        '224:A5:2:0.28  226:C#6:2:0.30  228:E6:2:0.31  230:G6:2:0.32  232:E6:2:0.31  234:C#6:2:0.30  236:A5:2:0.28  238:G6:2:0.32 ' +
        // Bar 16 — Dm (FINE TRIONFALE 8va alta)
        '240:D6:2:0.32  242:F6:2:0.34  244:A6:2:0.36  246:D7:4:0.42  250:A6:2:0.36  252:F6:2:0.34  254:D6:2:0.32'
      ),
      counter: E(
        // === A controcanto ===
        '1:A3:1:0.10  3:D4:1:0.10  5:F4:1:0.10  7:A4:1:0.10  9:F4:1:0.10  11:D4:1:0.10  13:A3:1:0.10  15:D4:1:0.10 ' +
        '17:Bb3:1:0.10  19:D4:1:0.10  21:F4:1:0.11  23:Bb4:1:0.11  25:F4:1:0.10  27:D4:1:0.10  29:Bb3:1:0.10  31:F4:1:0.10 ' +
        '33:A3:1:0.10  35:C#4:1:0.11  37:E4:1:0.11  39:A4:1:0.12  41:E4:1:0.11  43:C#4:1:0.10  45:A3:1:0.10  47:E4:1:0.11 ' +
        '49:D4:1:0.11  51:F4:1:0.11  53:A4:1:0.12  55:F4:1:0.11  57:D4:1:0.11  59:A3:1:0.10  61:F4:1:0.11  63:A4:1:0.12 ' +
        '65:A4:1:0.12  67:D5:1:0.13  69:F5:1:0.14  71:A5:1:0.15  73:F5:1:0.14  75:D5:1:0.13  77:A4:1:0.12  79:D5:1:0.13 ' +
        '81:Bb4:1:0.12  83:D5:1:0.13  85:F5:1:0.14  87:Bb5:1:0.15  89:F5:1:0.14  91:D5:1:0.13  93:A4:1:0.12  95:D5:1:0.13 ' +
        '97:A4:1:0.12  99:C#5:1:0.13  101:E5:1:0.14  103:A5:1:0.15  105:E5:1:0.14  107:C#5:1:0.13  109:A4:1:0.12  111:E5:1:0.14 ' +
        '113:D5:1:0.13  115:F5:1:0.14  117:A5:1:0.15  119:D6:1:0.16  121:A5:1:0.15  123:F5:1:0.14  125:D5:1:0.13  127:F5:1:0.14 ' +
        // === B controcanto: triadi spezzate intense ===
        '129:G4:1:0.13  131:Bb4:1:0.14  133:D5:1:0.15  135:G5:1:0.16  137:Bb4:1:0.14  139:D5:1:0.15  141:G5:1:0.16  143:D5:1:0.15 ' +
        '145:Eb4:1:0.13  147:G4:1:0.14  149:Bb4:1:0.15  151:Eb5:1:0.16  153:G4:1:0.14  155:Bb4:1:0.15  157:Eb5:1:0.16  159:Bb4:1:0.15 ' +
        '161:Bb4:1:0.14  163:D5:1:0.15  165:F5:1:0.16  167:Bb5:1:0.18  169:D5:1:0.15  171:F5:1:0.16  173:Bb5:1:0.18  175:F5:1:0.16 ' +
        '177:F#4:1:0.14  179:A4:1:0.15  181:C5:1:0.16  183:F#5:1:0.18  185:A4:1:0.15  187:C5:1:0.16  189:F#5:1:0.18  191:D5:1:0.16 ' +
        '193:G5:1:0.17  195:Bb5:1:0.18  197:D6:1:0.20  199:G6:1:0.22  201:Bb5:1:0.18  203:D6:1:0.20  205:G6:1:0.22  207:D6:1:0.20 ' +
        '209:C5:1:0.16  211:Eb5:1:0.17  213:G5:1:0.18  215:C6:1:0.20  217:Eb5:1:0.17  219:G5:1:0.18  221:C6:1:0.20  223:G5:1:0.18 ' +
        '225:A4:1:0.17  227:C#5:1:0.18  229:E5:1:0.19  231:A5:1:0.21  233:C#5:1:0.18  235:E5:1:0.19  237:A5:1:0.21  239:G5:1:0.20 ' +
        '241:D5:1:0.20  243:F5:1:0.22  245:A5:1:0.24  247:D6:1:0.28  249:A5:1:0.24  251:F5:1:0.22  253:A5:1:0.24  255:D6:1:0.30'
      ),
      harmony: C(
        // === A ===
        '0:D4+F4+A4:8:0.13  8:D4+F4+A4:8:0.13 ' +
        '16:Bb3+D4+F4:8:0.13  24:Bb3+D4+F4:8:0.13 ' +
        '32:A3+C#4+E4:8:0.14  40:A3+C#4+E4:8:0.14 ' +
        '48:D4+F4+A4:8:0.13  56:D4+F4+A4:8:0.13 ' +
        '64:D4+F4+A4:8:0.15  72:D4+F4+A4:8:0.15 ' +
        '80:G3+Bb3+D4:8:0.14  88:G3+Bb3+D4:8:0.14 ' +
        '96:A3+C#4+E4:8:0.16  104:A3+C#4+E4:8:0.17 ' +
        '112:D4+F4+A4:8:0.18  120:D4+F4+A4:8:0.20 ' +
        // === B ===
        '128:G3+Bb3+D4:8:0.16  136:G3+Bb3+D4:8:0.16 ' +
        '144:Eb3+G3+Bb3:8:0.16  152:Eb3+G3+Bb3:8:0.17 ' +
        '160:Bb3+D4+F4:8:0.17  168:Bb3+D4+F4:8:0.18 ' +
        '176:D3+F#3+A3+C4:8:0.19  184:D3+F#3+A3+C4:8:0.20 ' +
        '192:G3+Bb3+D4:8:0.20  200:G3+Bb3+D4:8:0.21 ' +
        '208:C3+Eb3+G3:8:0.20  216:C3+Eb3+G3:8:0.21 ' +
        '224:A3+C#4+E4+G4:8:0.22  232:A3+C#4+E4+G4:8:0.24 ' +
        '240:D3+F3+A3+D4:8:0.26  248:D3+F3+A3+D4+F4:8:0.30'
      ),
      bass: E(
        // === A: marcia dotted ===
        '0:D2:2:0.18  2:D2:2:0.16  4:A2:2:0.18  6:D2:2:0.16  8:D2:2:0.18  10:F2:2:0.16  12:A2:2:0.18  14:F2:2:0.16 ' +
        '16:Bb2:2:0.18  18:Bb2:2:0.16  20:F2:2:0.18  22:Bb2:2:0.16  24:Bb2:2:0.18  26:D3:2:0.16  28:F2:2:0.18  30:Bb2:2:0.16 ' +
        '32:A2:2:0.18  34:A2:2:0.16  36:E3:2:0.18  38:A2:2:0.16  40:A2:2:0.18  42:C#3:2:0.16  44:E3:2:0.18  46:A2:2:0.16 ' +
        '48:D2:2:0.18  50:D2:2:0.16  52:A2:2:0.18  54:D2:2:0.16  56:D2:2:0.18  58:F2:2:0.16  60:A2:2:0.18  62:D3:2:0.18 ' +
        '64:D2:2:0.20  66:D2:2:0.18  68:A2:2:0.20  70:D2:2:0.18  72:D2:2:0.20  74:F2:2:0.18  76:A2:2:0.20  78:F2:2:0.18 ' +
        '80:G2:2:0.20  82:G2:2:0.18  84:D3:2:0.20  86:G2:2:0.18  88:G2:2:0.20  90:Bb2:2:0.18  92:D3:2:0.20  94:Bb2:2:0.18 ' +
        '96:A2:2:0.20  98:A2:2:0.18  100:E3:2:0.20  102:A2:2:0.18  104:A2:2:0.20  106:C#3:2:0.18  108:E3:2:0.20  110:A2:2:0.18 ' +
        '112:D2:2:0.22  114:D2:2:0.20  116:A2:2:0.22  118:D3:2:0.20  120:D2:2:0.22  122:F2:2:0.20  124:A2:2:0.22  126:D3:2:0.22 ' +
        // === B: shift cromatico più aggressivo ===
        '128:G2:2:0.20  130:G2:2:0.18  132:D3:2:0.20  134:G2:2:0.18  136:G2:2:0.20  138:Bb2:2:0.18  140:D3:2:0.20  142:Bb2:2:0.18 ' +
        '144:Eb2:2:0.22  146:Eb2:2:0.20  148:Bb2:2:0.22  150:Eb2:2:0.20  152:Eb2:2:0.22  154:G2:2:0.20  156:Bb2:2:0.22  158:G2:2:0.20 ' +
        '160:Bb2:2:0.22  162:Bb2:2:0.20  164:F3:2:0.22  166:Bb2:2:0.20  168:Bb2:2:0.22  170:D3:2:0.20  172:F3:2:0.22  174:D3:2:0.20 ' +
        '176:D2:2:0.24  178:F#2:2:0.22  180:A2:2:0.24  182:D3:2:0.22  184:D2:2:0.24  186:F#2:2:0.22  188:A2:2:0.24  190:F#2:2:0.22 ' +
        '192:G2:2:0.24  194:G2:2:0.22  196:D3:2:0.24  198:G2:2:0.22  200:G2:2:0.24  202:Bb2:2:0.22  204:D3:2:0.24  206:Bb2:2:0.22 ' +
        '208:C2:2:0.26  210:C2:2:0.24  212:G2:2:0.26  214:C2:2:0.24  216:C2:2:0.26  218:Eb2:2:0.24  220:G2:2:0.26  222:Eb2:2:0.24 ' +
        '224:A2:2:0.28  226:A2:2:0.26  228:E3:2:0.28  230:A2:2:0.26  232:A2:2:0.28  234:C#3:2:0.26  236:E3:2:0.28  238:A2:2:0.26 ' +
        '240:D2:2:0.32  242:D2:2:0.28  244:A2:2:0.32  246:D3:2:0.28  248:D2:2:0.34  250:F2:2:0.30  252:A2:2:0.32  254:D3:2:0.36'
      ),
      drums: drums,
    });
  }

  function makeMoonlightTrack() {
    /* "OMBRE NEL CASTELLO" — A minor, dark Batman/Inception ostinato.
       16 bars (256 step). A: build crescente. B: battaglia frenetica. */
    const drums = [];
    [0,8,16,24,32,40,48,56,64,72,80,88,96,104,112,120].forEach(function (s) {
      drums.push([s, 'kick', s < 64 ? 0.22 : 0.34]);
    });
    [4,12,20,28,36,44,52,60].forEach(function (s) { drums.push([s, 'snare', 0.14]); });
    [68,76,84,92,100,108,116,124].forEach(function (s) { drums.push([s, 'snare', 0.22]); });
    // B section: doppia velocità di kick + snare martellante
    [128,132,136,140,144,148,152,156,160,164,168,172,176,180,184,188,
     192,196,200,204,208,212,216,220,224,228,232,236,240,244,248,252].forEach(function (s) {
      drums.push([s, 'kick', s < 192 ? 0.36 : 0.40]);
    });
    [130,134,138,142,146,150,154,158,162,166,170,174,178,182,186,190,
     194,198,202,206,210,214,218,222,226,230,234,238,242,246,250,254].forEach(function (s) {
      drums.push([s, 'snare', s < 192 ? 0.26 : 0.32]);
    });
    addHatPattern(drums, 64, 4, 0.06);
    addHatPattern(drums, 128, 2, 0.10, 64);
    addHatPattern(drums, 256, 2, 0.14, 128);
    drums.push([0,'crash',0.20],[64,'crash',0.30],[96,'crash',0.32]);
    drums.push([128,'crash',0.36],[160,'crash',0.32],[192,'crash',0.40],[224,'crash',0.42],[248,'crash',0.50]);
    drums.push([62,'tom',0.20],[63,'tom',0.24],[94,'tom',0.20],[95,'tom',0.24],[126,'tom',0.26],[127,'tom',0.30]);
    drums.push([190,'tom',0.30],[191,'tom',0.34],[222,'tom',0.30],[223,'tom',0.36],[254,'tom',0.40],[255,'tom',0.50]);
    return buildTrack(124, 256, {
      // Tema scuro che esplode: pochissime note all'inizio, sviluppo finale.
      lead: E(
        // === A: build crescente ===
        '0:A4:4:0.16  4:E5:4:0.18  8:A5:8:0.20 ' +
        '16:E5:2:0.16  18:F5:2:0.16  20:E5:4:0.16  24:C5:4:0.16  28:A4:4:0.16 ' +
        '32:D5:4:0.18  36:F5:4:0.20  40:A5:8:0.22 ' +
        '48:E5:2:0.18  50:G#5:2:0.20  52:B5:2:0.20  54:E6:4:0.24  58:D6:2:0.22  60:B5:2:0.20  62:G#5:2:0.20 ' +
        '64:A5:2:0.26  66:C6:2:0.28  68:E6:2:0.30  70:A6:4:0.34  74:G6:2:0.30  76:E6:2:0.28  78:C6:2:0.26 ' +
        '80:D6:2:0.28  82:F6:2:0.30  84:A6:4:0.32  88:G6:2:0.30  90:F6:2:0.28  92:D6:4:0.26 ' +
        '96:E6:2:0.28  98:G#6:2:0.30  100:B6:4:0.34  104:A6:2:0.32  106:G#6:2:0.30  108:E6:2:0.28  110:B5:2:0.26 ' +
        '112:A6:2:0.32  114:C7:2:0.34  116:E7:4:0.38  120:C7:2:0.34  122:A6:2:0.32  124:E6:4:0.30 ' +
        // === B: battaglia furiosa, 16esimi e accenti pesanti ===
        '128:A6:1:0.32  130:G6:1:0.30  132:E6:2:0.32  134:A6:2:0.34  136:C7:1:0.36  138:B6:1:0.34  140:A6:2:0.34  142:G6:2:0.32 ' +
        '144:F6:2:0.30  146:G6:2:0.32  148:A6:2:0.34  150:F6:2:0.30  152:D6:2:0.28  154:F6:2:0.30  156:A6:2:0.34  158:D7:2:0.40 ' +
        '160:G6:2:0.32  162:Bb6:2:0.34  164:D7:2:0.38  166:Bb6:2:0.34  168:G6:2:0.32  170:F6:2:0.30  172:E6:2:0.28  174:G6:2:0.32 ' +
        '176:E6:1:0.30  178:G#6:1:0.32  180:B6:2:0.36  182:E7:2:0.42  184:D7:1:0.38  186:B6:1:0.34  188:G#6:2:0.32  190:E6:2:0.30 ' +
        '192:A6:2:0.36  194:C7:2:0.38  196:E7:2:0.42  198:A7:4:0.48  202:G7:2:0.42  204:E7:2:0.38  206:C7:2:0.36 ' +
        '208:D7:2:0.36  210:F7:2:0.38  212:A7:4:0.46  216:G7:2:0.42  218:F7:2:0.38  220:D7:2:0.36  222:F7:2:0.38 ' +
        '224:E7:2:0.40  226:G7:2:0.42  228:B7:4:0.50  232:A7:2:0.46  234:G7:2:0.42  236:E7:2:0.38  238:G7:2:0.42 ' +
        '240:A7:2:0.50  242:C8:2:0.54  244:E7:2:0.42  246:A7:4:0.56  250:E7:2:0.44  252:C7:2:0.40  254:A6:2:0.36'
      ),
      counter: E(
        // === A: ostinato che cresce ===
        '0:A3:1:0.07  2:E4:1:0.07  4:A3:1:0.07  6:E4:1:0.07  8:A3:1:0.08  10:E4:1:0.08  12:A3:1:0.08  14:E4:1:0.08 ' +
        '16:A3:1:0.08  18:E4:1:0.08  20:A3:1:0.08  22:E4:1:0.08  24:A3:1:0.09  26:E4:1:0.09  28:A3:1:0.09  30:E4:1:0.09 ' +
        '32:D4:1:0.10  34:A4:1:0.10  36:D4:1:0.10  38:A4:1:0.10  40:D4:1:0.11  42:A4:1:0.11  44:D4:1:0.11  46:A4:1:0.11 ' +
        '48:E4:1:0.12  50:B4:1:0.12  52:E4:1:0.12  54:G#4:1:0.12  56:E4:1:0.13  58:G#4:1:0.13  60:E4:1:0.13  62:B4:1:0.13 ' +
        '65:C5:1:0.13  67:E5:1:0.14  69:C5:1:0.13  71:A4:1:0.13  73:E5:1:0.14  75:A4:1:0.13  77:C5:1:0.13  79:E5:1:0.14 ' +
        '81:F5:1:0.14  83:A5:1:0.15  85:F5:1:0.14  87:D5:1:0.13  89:A5:1:0.15  91:D5:1:0.13  93:F5:1:0.14  95:A5:1:0.15 ' +
        '97:E5:1:0.15  99:G#5:1:0.16  101:E5:1:0.15  103:B5:1:0.16  105:G#5:1:0.16  107:E5:1:0.15  109:B5:1:0.16  111:E6:1:0.18 ' +
        '113:C6:1:0.18  115:E6:1:0.20  117:A5:1:0.18  119:C6:1:0.18  121:E6:1:0.20  123:C6:1:0.18  125:A5:1:0.18  127:E6:1:0.22 ' +
        // === B: arpeggi 16esimi furiosi ===
        '128:A4:1:0.18  130:C5:1:0.18  132:E5:1:0.20  134:A5:1:0.22  136:C6:1:0.22  138:E6:1:0.24  140:A5:1:0.22  142:C6:1:0.22 ' +
        '144:D5:1:0.18  146:F5:1:0.20  148:A5:1:0.22  150:D6:1:0.24  152:F6:1:0.24  154:A6:1:0.26  156:D6:1:0.24  158:F6:1:0.24 ' +
        '160:G4:1:0.18  162:Bb4:1:0.20  164:D5:1:0.20  166:G5:1:0.22  168:Bb5:1:0.22  170:D6:1:0.24  172:G5:1:0.22  174:Bb5:1:0.22 ' +
        '176:E5:1:0.20  178:G#5:1:0.22  180:B5:1:0.24  182:E6:1:0.26  184:G#6:1:0.28  186:B6:1:0.30  188:E6:1:0.26  190:G#6:1:0.28 ' +
        '192:A5:1:0.24  194:C6:1:0.26  196:E6:1:0.28  198:A6:1:0.30  200:C7:1:0.32  202:E7:1:0.34  204:A6:1:0.30  206:C7:1:0.32 ' +
        '208:D5:1:0.24  210:F5:1:0.26  212:A5:1:0.28  214:D6:1:0.30  216:F6:1:0.32  218:A6:1:0.34  220:D6:1:0.30  222:F6:1:0.32 ' +
        '224:E5:1:0.26  226:G#5:1:0.28  228:B5:1:0.30  230:E6:1:0.34  232:G#6:1:0.36  234:B6:1:0.38  236:E6:1:0.34  238:G#6:1:0.38 ' +
        '240:A5:1:0.32  242:C6:1:0.34  244:E6:1:0.38  246:A6:1:0.42  248:C7:1:0.46  250:E7:1:0.50  252:A6:1:0.46  254:E7:1:0.54'
      ),
      harmony: C(
        // === A ===
        '0:A3+C4+E4:8:0.10  8:A3+C4+E4:8:0.10 ' +
        '16:D4+F4+A4:8:0.10  24:D4+F4+A4:8:0.10 ' +
        '32:G3+B3+D4:8:0.11  40:G3+B3+D4:8:0.11 ' +
        '48:E4+G#4+B4:8:0.12  56:E4+G#4+B4:8:0.13 ' +
        '64:A3+C4+E4:8:0.16  72:A3+C4+E4:8:0.16 ' +
        '80:D4+F4+A4:8:0.16  88:D4+F4+A4:8:0.17 ' +
        '96:E4+G#4+B4:8:0.18  104:E4+G#4+B4:8:0.20 ' +
        '112:A3+C4+E4:8:0.22  120:A3+C4+E4:8:0.24 ' +
        // === B: chromatic battle ===
        '128:A3+C4+E4:8:0.24  136:A3+C4+E4:8:0.24 ' +
        '144:D4+F4+A4:8:0.24  152:D4+F4+A4:8:0.26 ' +
        '160:G3+Bb3+D4:8:0.26  168:G3+Bb3+D4:8:0.26 ' +
        '176:E4+G#4+B4:8:0.28  184:E4+G#4+B4:8:0.30 ' +
        '192:A3+C4+E4+A4:8:0.32  200:A3+C4+E4+A4:8:0.32 ' +
        '208:D3+F3+A3+D4:8:0.30  216:F3+A3+C4:8:0.32 ' +
        '224:E4+G#4+B4+E5:8:0.34  232:E4+G#4+B4+E5:8:0.38 ' +
        '240:A3+C4+E4+A4:8:0.42  248:A3+C4+E4+A4+C5:8:0.50'
      ),
      bass: E(
        // === A: bass minimal → intenso ===
        '0:A1:4:0.14  4:A1:4:0.14  8:E2:4:0.14  12:E2:4:0.14 ' +
        '16:A1:4:0.14  20:A1:4:0.14  24:E2:4:0.14  28:E2:4:0.14 ' +
        '32:D2:4:0.15  36:D2:4:0.15  40:A2:4:0.15  44:A2:4:0.15 ' +
        '48:E2:4:0.15  52:E2:4:0.15  54:G#2:2:0.15  56:E2:4:0.15  60:B2:4:0.15 ' +
        '64:A1:2:0.20  66:E2:2:0.18  68:A2:2:0.20  70:E2:2:0.18  72:A1:2:0.20  74:E2:2:0.18  76:A2:2:0.20  78:E2:2:0.18 ' +
        '80:D2:2:0.20  82:A2:2:0.18  84:D3:2:0.20  86:A2:2:0.18  88:D2:2:0.20  90:F2:2:0.18  92:D3:2:0.20  94:A2:2:0.18 ' +
        '96:E2:2:0.22  98:B2:2:0.20  100:E3:2:0.22  102:B2:2:0.20  104:E2:2:0.22  106:G#2:2:0.20  108:E3:2:0.22  110:B2:2:0.20 ' +
        '112:A1:2:0.26  114:E2:2:0.24  116:A2:2:0.26  118:E2:2:0.24  120:A1:2:0.28  122:E2:2:0.26  124:A2:2:0.28  126:E3:2:0.30 ' +
        // === B: bass implacabile, doppi colpi ===
        '128:A1:1:0.30  130:E2:1:0.28  132:A1:1:0.30  134:E2:1:0.28  136:A1:1:0.30  138:C3:1:0.28  140:E3:1:0.30  142:C3:1:0.28 ' +
        '144:D2:1:0.32  146:A2:1:0.30  148:D2:1:0.32  150:A2:1:0.30  152:D2:1:0.32  154:F2:1:0.30  156:A2:1:0.32  158:D3:1:0.30 ' +
        '160:G1:1:0.32  162:D2:1:0.30  164:G1:1:0.32  166:D2:1:0.30  168:G1:1:0.32  170:Bb2:1:0.30  172:D3:1:0.32  174:Bb2:1:0.30 ' +
        '176:E2:1:0.34  178:B2:1:0.32  180:E2:1:0.34  182:G#2:1:0.32  184:E2:1:0.34  186:B2:1:0.32  188:E3:1:0.34  190:G#3:1:0.32 ' +
        '192:A1:1:0.40  194:E2:1:0.38  196:A1:1:0.40  198:E2:1:0.38  200:A1:1:0.40  202:C3:1:0.38  204:E3:1:0.40  206:A2:1:0.38 ' +
        '208:D2:1:0.40  210:A2:1:0.38  212:D2:1:0.40  214:F2:1:0.38  216:D2:1:0.40  218:A2:1:0.38  220:D3:1:0.42  222:F3:1:0.40 ' +
        '224:E2:1:0.42  226:B2:1:0.40  228:E2:1:0.42  230:G#2:1:0.40  232:E2:1:0.42  234:B2:1:0.40  236:E3:1:0.44  238:G#3:1:0.42 ' +
        '240:A1:1:0.48  242:E2:1:0.46  244:A1:1:0.48  246:E2:1:0.46  248:A1:1:0.50  250:C3:1:0.48  252:E3:1:0.50  254:A3:1:0.56'
      ),
      drums: drums,
    });
  }

  const TRACKS = {
    0: addOrchestralLayers(makeSunriseTrack(), {
      padVelocity: 0.24,
      tenorVelocity: 0.14,
      choirVelocity: 0.1,
      brassVelocity: 0.14,
      ostinatoVelocity: 0.11,
      shimmerVelocity: 0.06,
      droneVelocity: 0.08,
      choirEvery: 16,
      droneEvery: 32,
      brassEvery: 16,
      shimmerEvery: 32,
      padExtraLen: 2,
    }),
    1: addOrchestralLayers(makeSunsetTrack(), {
      padVelocity: 0.28,
      tenorVelocity: 0.16,
      choirVelocity: 0.12,
      brassVelocity: 0.18,
      ostinatoVelocity: 0.12,
      shimmerVelocity: 0.07,
      droneVelocity: 0.1,
      choirEvery: 8,
      droneEvery: 16,
      brassEvery: 8,
      shimmerEvery: 16,
      padExtraLen: 3,
    }),
    2: addOrchestralLayers(makeMoonlightTrack(), {
      padVelocity: 0.32,
      tenorVelocity: 0.16,
      choirVelocity: 0.16,
      brassVelocity: 0.2,
      ostinatoVelocity: 0.11,
      shimmerVelocity: 0.08,
      droneVelocity: 0.12,
      choirEvery: 8,
      droneEvery: 16,
      brassEvery: 8,
      shimmerEvery: 16,
      padExtraLen: 4,
    }),
  };

  const VOICES = {
    lead: { type: 'square', attack: 0.005, decay: 0.08, sustain: 0.72, release: 0.05, filter: 1800, q: 0.7, detuneSpread: 2.5, layers: [{ type: 'square', detune: -4, gain: 0.54 }, { type: 'square', detune: 4, gain: 0.46 }] },
    counter: { type: 'square', attack: 0.004, decay: 0.06, sustain: 0.48, release: 0.04, filter: 1500, q: 0.65, detuneSpread: 1.4, layers: [{ type: 'square', detune: 0, gain: 0.7 }, { type: 'triangle', detune: 7, gain: 0.3 }] },
    harmony: { type: 'square', attack: 0.006, decay: 0.1, sustain: 0.6, release: 0.05, filter: 1400, q: 0.55, detuneSpread: 1.6, layers: [{ type: 'square', detune: -3, gain: 0.56 }, { type: 'triangle', detune: 3, gain: 0.44 }] },
    bass: { type: 'triangle', attack: 0.004, decay: 0.06, sustain: 0.68, release: 0.06, filter: 720, q: 0.22, layers: [{ type: 'triangle', detune: 0, gain: 0.72 }, { type: 'sine', detune: -2, gain: 0.28 }] },
    tenor: { type: 'sawtooth', attack: 0.012, decay: 0.14, sustain: 0.58, release: 0.1, filter: 1180, q: 0.44, detuneSpread: 4.2, layers: [{ type: 'sawtooth', detune: -6, gain: 0.52 }, { type: 'square', detune: 5, gain: 0.48 }] },
    pad: { type: 'sawtooth', attack: 0.028, decay: 0.22, sustain: 0.86, release: 0.2, filter: 940, q: 0.24, detuneSpread: 4.6, layers: [{ type: 'sawtooth', detune: -9, gain: 0.4 }, { type: 'triangle', detune: 0, gain: 0.24 }, { type: 'sawtooth', detune: 9, gain: 0.36 }] },
    choir: { type: 'triangle', attack: 0.02, decay: 0.14, sustain: 0.82, release: 0.18, filter: 1500, q: 0.32, detuneSpread: 2.6, layers: [{ type: 'triangle', detune: -4, gain: 0.46 }, { type: 'sine', detune: 0, gain: 0.2 }, { type: 'triangle', detune: 4, gain: 0.34 }] },
    ostinato: { type: 'square', attack: 0.002, decay: 0.05, sustain: 0.32, release: 0.025, filter: 2350, q: 0.82, detuneSpread: 1.1, layers: [{ type: 'square', detune: -2, gain: 0.64 }, { type: 'triangle', detune: 2, gain: 0.36 }] },
    brass: { type: 'sawtooth', attack: 0.008, decay: 0.12, sustain: 0.56, release: 0.085, filter: 1100, q: 0.52, detuneSpread: 5.8, layers: [{ type: 'sawtooth', detune: -8, gain: 0.46 }, { type: 'square', detune: 0, gain: 0.22 }, { type: 'sawtooth', detune: 8, gain: 0.32 }] },
    sub: { type: 'sine', attack: 0.006, decay: 0.08, sustain: 0.86, release: 0.12, filter: 420, q: 0.16, layers: [{ type: 'sine', detune: 0, gain: 0.72 }, { type: 'triangle', detune: 3, gain: 0.28 }] },
    shimmer: { type: 'triangle', attack: 0.01, decay: 0.08, sustain: 0.26, release: 0.16, filter: 2800, q: 0.72, detuneSpread: 3.1, layers: [{ type: 'triangle', detune: -6, gain: 0.44 }, { type: 'square', detune: 6, gain: 0.26 }, { type: 'triangle', detune: 0, gain: 0.3 }] },
  };

  let ctx = null;
  let musicBus = null;
  let sfxBus = null;
  let masterBus = null;
  let noiseBuffer = null;
  let schedulerHandle = null;
  let activeTrack = null;
  let activeTrackId = null;
  let pendingTrackId = null;
  let nextStepTime = 0;
  let stepIndex = 0;
  let tempoMultiplier = 1.0;        // 1.0 = normale, >1 = più veloce
  let jingleHandle = null;          // timeout per ripristinare il loop dopo un jingle
  let audioPrimed = false;

  function ensureContext() {
    if (!AudioCtx) return false;
    if (ctx) return true;

    ctx = new AudioCtx();

    masterBus = ctx.createGain();
    masterBus.gain.value = 0.28;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.18;

    const ambienceSend = ctx.createGain();
    ambienceSend.gain.value = 0.17;
    const shortDelay = ctx.createDelay(1.0);
    shortDelay.delayTime.value = 0.115;
    const longDelay = ctx.createDelay(1.0);
    longDelay.delayTime.value = 0.235;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.26;
    const ambienceTone = ctx.createBiquadFilter();
    ambienceTone.type = 'lowpass';
    ambienceTone.frequency.value = 1850;
    ambienceTone.Q.value = 0.28;
    const ambienceMix = ctx.createGain();
    ambienceMix.gain.value = 0.23;

    musicBus = ctx.createGain();
    musicBus.gain.value = DEFAULT_MUSIC_GAIN;

    sfxBus = ctx.createGain();
    sfxBus.gain.value = DEFAULT_SFX_GAIN;

    musicBus.connect(compressor);
    musicBus.connect(ambienceSend);
    sfxBus.connect(compressor);
    ambienceSend.connect(shortDelay);
    ambienceSend.connect(longDelay);
    longDelay.connect(feedback);
    feedback.connect(longDelay);
    shortDelay.connect(ambienceTone);
    longDelay.connect(ambienceTone);
    ambienceTone.connect(ambienceMix);
    ambienceMix.connect(compressor);
    compressor.connect(masterBus);
    masterBus.connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return true;
  }

  function primeMobileAudio(force) {
    if (!ctx || !masterBus) return;
    if (ctx.state !== 'running') return;
    if (audioPrimed && !force) return;
    try {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, now + 0.03);
      osc.connect(gainNode);
      gainNode.connect(masterBus);
      osc.start(now);
      osc.stop(now + 0.035);
      audioPrimed = true;
    } catch (err) {}
  }

  function resumePendingTrack() {
    if (pendingTrackId === null || !ctx || ctx.state !== 'running') return;
    const levelIndex = pendingTrackId;
    pendingTrackId = null;
    playLevelTrack(levelIndex);
  }

  function afterResume() {
    primeMobileAudio(true);
    resumePendingTrack();
    setTimeout(resumePendingTrack, 80);
  }

  function stepSeconds(track) {
    return (60 / track.tempo / 4) / Math.max(0.25, tempoMultiplier);
  }

  function setTempoMultiplier(mult) {
    tempoMultiplier = Math.max(0.5, Math.min(2.5, mult || 1.0));
  }

  function scheduleEnvelope(gainNode, time, duration, velocity, voice) {
    const peak = velocity;
    const sustainLevel = peak * voice.sustain;
    const attackEnd = time + voice.attack;
    const decayEnd = Math.min(time + duration * 0.65, attackEnd + voice.decay);
    const releaseStart = Math.max(decayEnd, time + duration - voice.release);

    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.linearRampToValueAtTime(peak, attackEnd);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, decayEnd);
    gainNode.gain.setValueAtTime(sustainLevel, releaseStart);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.01);
  }

  function toFrequency(value) {
    if (typeof value === 'number') return value;
    return noteToFrequency(value);
  }

  function scheduleSfxEnvelope(gainNode, time, peak, attack, hold, release) {
    const attackTime = Math.max(0.001, attack || 0.004);
    const holdTime = Math.max(0.001, hold || 0.01);
    const releaseTime = Math.max(0.02, release || 0.06);
    const peakValue = Math.max(0.0001, peak || 0.08);

    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.linearRampToValueAtTime(peakValue, time + attackTime);
    gainNode.gain.setValueAtTime(peakValue, time + attackTime + holdTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      time + attackTime + holdTime + releaseTime
    );
  }

  function scheduleSfxTone(config) {
    if (!ctx || !sfxBus) return;

    const time = config.time;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();
    const duration = Math.max(0.04, config.duration || 0.12);
    const startFreq = toFrequency(config.startFreq || config.note || 'C5');
    const endFreq = config.endFreq ? toFrequency(config.endFreq) : null;

    osc.type = config.type || 'square';
    osc.frequency.setValueAtTime(startFreq, time);
    if (config.detune) {
      osc.detune.setValueAtTime(config.detune, time);
    }
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), time + duration);
    }

    filter.type = config.filterType || 'lowpass';
    filter.frequency.setValueAtTime(config.filterFreq || 2000, time);
    filter.Q.value = config.q == null ? 0.6 : config.q;

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(sfxBus);

    scheduleSfxEnvelope(
      gainNode,
      time,
      config.volume || 0.08,
      config.attack,
      config.hold || duration * 0.18,
      config.release || duration * 0.76
    );

    osc.start(time);
    osc.stop(time + duration + 0.06);
  }

  function scheduleSfxNoise(config) {
    if (!ctx || !sfxBus || !noiseBuffer) return;

    const time = config.time;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();
    const duration = Math.max(0.03, config.duration || 0.07);

    source.buffer = noiseBuffer;
    filter.type = config.filterType || 'highpass';
    filter.frequency.setValueAtTime(config.filterFreq || 2400, time);
    filter.Q.value = config.q == null ? 0.8 : config.q;

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(sfxBus);

    scheduleSfxEnvelope(
      gainNode,
      time,
      config.volume || 0.04,
      config.attack || 0.002,
      config.hold || duration * 0.12,
      config.release || duration * 0.88
    );

    source.start(time);
    source.stop(time + duration + 0.04);
  }

  function scheduleTone(note, time, duration, velocity, voiceName) {
    if (!ctx || !musicBus || !note) return;
    const voice = VOICES[voiceName];
    const notes = Array.isArray(note) ? note : [note];
    const layers = voice.layers || [{ type: voice.type, detune: 0, gain: 1 }];

    notes.forEach(function (noteName, idx) {
      layers.forEach(function (layer) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gainNode = ctx.createGain();

        osc.type = layer.type || voice.type;
        osc.frequency.setValueAtTime(noteToFrequency(noteName), time);
        const spread = voice.detuneSpread || 0;
        const baseDetune = (idx - (notes.length - 1) * 0.5) * spread;
        osc.detune.setValueAtTime(baseDetune + (layer.detune || 0), time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(layer.filter || voice.filter, time);
        filter.Q.value = layer.q == null
          ? (voice.q == null ? (voiceName === 'bass' ? 0.2 : 0.6) : voice.q)
          : layer.q;

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(musicBus);

        scheduleEnvelope(
          gainNode,
          time,
          duration,
          (velocity * (layer.gain == null ? 1 : layer.gain)) / Math.max(1, notes.length),
          voice
        );

        osc.start(time);
        osc.stop(time + duration + 0.08);
      });
    });
  }

  function scheduleKick(time, velocity) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.18);
    gainNode.gain.setValueAtTime(velocity, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(gainNode);
    gainNode.connect(musicBus);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  function scheduleNoiseDrum(time, velocity, kind) {
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    source.buffer = noiseBuffer;
    if (kind === 'snare') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, time);
      filter.Q.value = 0.7;
      gainNode.gain.setValueAtTime(velocity, time);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    } else {
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(5200, time);
      filter.Q.value = 0.8;
      gainNode.gain.setValueAtTime(velocity, time);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    }

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(musicBus);
    source.start(time);
    source.stop(time + (kind === 'snare' ? 0.14 : 0.07));
  }

  function scheduleTom(time, velocity) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, time);
    osc.frequency.exponentialRampToValueAtTime(74, time + 0.24);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(820, time);
    filter.Q.value = 0.4;
    gainNode.gain.setValueAtTime(velocity, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(musicBus);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  function scheduleCrash(time, velocity) {
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    source.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3600, time);
    filter.Q.value = 0.7;
    gainNode.gain.setValueAtTime(velocity, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(musicBus);
    source.start(time);
    source.stop(time + 0.3);
  }

  function scheduleDrum(event, time) {
    if (event.kind === 'kick') scheduleKick(time, event.velocity);
    else if (event.kind === 'snare') scheduleNoiseDrum(time, event.velocity, 'snare');
    else if (event.kind === 'hat') scheduleNoiseDrum(time, event.velocity, 'hat');
    else if (event.kind === 'tom') scheduleTom(time, event.velocity);
    else if (event.kind === 'crash') scheduleCrash(time, event.velocity);
  }

  function scheduleStep(track, index, time) {
    const step = track.steps[index];
    ['lead', 'counter', 'harmony', 'bass', 'tenor', 'pad', 'choir', 'ostinato', 'brass', 'sub', 'shimmer'].forEach(function (voiceName) {
      step[voiceName].forEach(function (event) {
        scheduleTone(
          event.note,
          time,
          event.len * stepSeconds(track) * 0.96,
          event.velocity,
          voiceName
        );
      });
    });
    step.drums.forEach(function (event) {
      scheduleDrum(event, time);
    });
  }

  function stopScheduler() {
    if (schedulerHandle) {
      clearInterval(schedulerHandle);
      schedulerHandle = null;
    }
  }

  function scheduler() {
    if (!ctx || !activeTrack) return;
    const lookAhead = 0.16;
    while (nextStepTime < ctx.currentTime + lookAhead) {
      scheduleStep(activeTrack, stepIndex, nextStepTime);
      nextStepTime += stepSeconds(activeTrack);
      stepIndex = (stepIndex + 1) % activeTrack.length;
    }
  }

  function playLevelTrack(levelIndex) {
    if (!ensureContext()) return;
    const track = TRACKS[levelIndex] || TRACKS[0];
    if (!track) return;
    // Cancella un eventuale ripristino-jingle che potrebbe sovrascrivere la
    // nuova traccia (race condition tra fine jingle e cambio livello).
    if (jingleHandle) { clearTimeout(jingleHandle); jingleHandle = null; }

    if (ctx.state !== 'running') {
      pendingTrackId = levelIndex;
      if (ctx.resume) {
        ctx.resume().then(afterResume).catch(function () {});
      }
      return;
    }

    pendingTrackId = null;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), ctx.currentTime);
    musicBus.gain.exponentialRampToValueAtTime(DEFAULT_MUSIC_GAIN, ctx.currentTime + 0.08);

    activeTrack = track;
    activeTrackId = levelIndex;
    stepIndex = 0;
    nextStepTime = ctx.currentTime + 0.05;
    stopScheduler();
    scheduler();
    schedulerHandle = setInterval(scheduler, 25);
  }

  function stop() {
    if (!ctx || !musicBus) return;
    pendingTrackId = null;
    stopScheduler();
    activeTrack = null;
    activeTrackId = null;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
  }

  function playSfx(name) {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }

    const now = ctx.currentTime + 0.006;

    switch (name) {
      case 'jump':
        scheduleSfxTone({
          time: now,
          type: 'square',
          note: 'G4',
          endFreq: 'C6',
          duration: 0.11,
          volume: 0.09,
          filterFreq: 1800,
        });
        scheduleSfxTone({
          time: now + 0.01,
          type: 'triangle',
          note: 'C4',
          endFreq: 'G3',
          duration: 0.12,
          volume: 0.045,
          filterFreq: 900,
          q: 0.25,
        });
        break;

      case 'coin':
        scheduleSfxTone({
          time: now,
          type: 'square',
          note: 'B5',
          endFreq: 'E6',
          duration: 0.07,
          volume: 0.11,
          filterFreq: 2500,
        });
        scheduleSfxTone({
          time: now + 0.055,
          type: 'square',
          note: 'E6',
          endFreq: 'G6',
          duration: 0.08,
          volume: 0.1,
          filterFreq: 2600,
        });
        break;

      case 'block':
        scheduleSfxNoise({
          time: now,
          duration: 0.035,
          volume: 0.03,
          filterType: 'bandpass',
          filterFreq: 980,
          q: 1.1,
        });
        scheduleSfxTone({
          time: now,
          type: 'square',
          note: 'C5',
          endFreq: 'G4',
          duration: 0.06,
          volume: 0.06,
          filterFreq: 1200,
        });
        break;

      case 'powerup_spawn':
        ['C5', 'E5', 'G5', 'C6'].forEach(function (note, idx) {
          scheduleSfxTone({
            time: now + idx * 0.05,
            type: 'square',
            note: note,
            endFreq: note,
            duration: 0.08,
            volume: 0.08,
            filterFreq: 2200,
          });
        });
        break;

      case 'powerup':
        ['C5', 'E5', 'G5', 'C6', 'E6'].forEach(function (note, idx) {
          scheduleSfxTone({
            time: now + idx * 0.055,
            type: 'square',
            note: note,
            endFreq: note,
            duration: 0.1,
            volume: 0.085,
            filterFreq: 2300,
          });
        });
        scheduleSfxTone({
          time: now + 0.29,
          type: 'triangle',
          note: 'C4',
          endFreq: 'C5',
          duration: 0.18,
          volume: 0.06,
          filterFreq: 1000,
          q: 0.3,
        });
        break;

      case 'enemy_hit':
        scheduleSfxTone({
          time: now,
          type: 'square',
          note: 'F4',
          endFreq: 'D4',
          duration: 0.08,
          volume: 0.07,
          filterFreq: 1100,
        });
        scheduleSfxNoise({
          time: now + 0.01,
          duration: 0.045,
          volume: 0.02,
          filterType: 'bandpass',
          filterFreq: 700,
          q: 0.9,
        });
        break;

      case 'stomp':
        scheduleSfxTone({
          time: now,
          type: 'square',
          note: 'D5',
          endFreq: 'A4',
          duration: 0.07,
          volume: 0.075,
          filterFreq: 1200,
        });
        scheduleSfxTone({
          time: now + 0.01,
          type: 'triangle',
          note: 'D3',
          endFreq: 'G2',
          duration: 0.08,
          volume: 0.05,
          filterFreq: 880,
          q: 0.25,
        });
        break;

      case 'hurt':
        scheduleSfxNoise({
          time: now,
          duration: 0.08,
          volume: 0.025,
          filterType: 'bandpass',
          filterFreq: 620,
          q: 0.8,
        });
        scheduleSfxTone({
          time: now,
          type: 'square',
          note: 'A5',
          endFreq: 'C4',
          duration: 0.3,
          volume: 0.085,
          filterFreq: 1400,
        });
        scheduleSfxTone({
          time: now + 0.02,
          type: 'triangle',
          note: 'A3',
          endFreq: 'D3',
          duration: 0.28,
          volume: 0.05,
          filterFreq: 850,
          q: 0.2,
        });
        break;

      case 'flag':
        ['G4', 'B4', 'D5', 'G5'].forEach(function (note, idx) {
          scheduleSfxTone({
            time: now + idx * 0.07,
            type: 'square',
            note: note,
            endFreq: note,
            duration: 0.09,
            volume: 0.082,
            filterFreq: 2100,
          });
        });
        scheduleSfxTone({
          time: now + 0.03,
          type: 'triangle',
          note: 'G3',
          endFreq: 'D4',
          duration: 0.22,
          volume: 0.05,
          filterFreq: 1000,
          q: 0.25,
        });
        break;

      case 'rescue':
        ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach(function (note, idx) {
          scheduleSfxTone({
            time: now + idx * 0.06,
            type: 'square',
            note: note,
            endFreq: note,
            duration: 0.11,
            volume: 0.088,
            filterFreq: 2400,
          });
        });
        scheduleSfxTone({
          time: now + 0.18,
          type: 'triangle',
          note: 'C4',
          endFreq: 'C5',
          duration: 0.3,
          volume: 0.06,
          filterFreq: 950,
          q: 0.2,
        });
        break;
    }
  }

  function playVictoryJingle() {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    // Ferma il loop e abbassa il bus per dare risalto al jingle
    const previousTrack = activeTrack;
    const previousId = activeTrackId;
    stopScheduler();
    activeTrack = null;
    activeTrackId = null;

    const t0 = ctx.currentTime + 0.02;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, t0);
    musicBus.gain.linearRampToValueAtTime(DEFAULT_MUSIC_GAIN, t0 + 0.05);

    // Fanfara orchestrale: brass arpeggio + lead motivo + crash
    const fanfare = [
      // step (s),    voice,    notes,                       len, vel
      [0.00, 'brass',  ['F3', 'A3', 'C4'],                  0.45, 0.46],
      [0.00, 'lead',   'F5',                                0.18, 0.42],
      [0.00, 'sub',    'F2',                                0.50, 0.40],
      [0.18, 'lead',   'A5',                                0.18, 0.44],
      [0.36, 'lead',   'C6',                                0.20, 0.46],
      [0.56, 'lead',   'F6',                                0.62, 0.50],
      [0.56, 'brass',  ['C4', 'F4', 'A4', 'C5'],            0.62, 0.42],
      [0.56, 'choir',  ['F4', 'A4', 'C5', 'F5'],            0.95, 0.30],
      [0.56, 'sub',    'F2',                                0.95, 0.40],
      [0.85, 'counter','C6',                                0.20, 0.30],
      [1.05, 'counter','A5',                                0.20, 0.30],
      [1.25, 'counter','F5',                                0.18, 0.30],
      [1.40, 'lead',   ['F5', 'A5', 'C6', 'F6'],            0.95, 0.50],
      [1.40, 'brass',  ['F4', 'A4', 'C5', 'F5'],            0.95, 0.46],
      [1.40, 'choir',  ['A4', 'C5', 'F5', 'A5'],            1.20, 0.32],
      [1.40, 'sub',    'F2',                                1.20, 0.42],
    ];
    fanfare.forEach(function (ev) {
      // scheduleTone(note, time, duration, velocity, voiceName)
      scheduleTone(ev[2], t0 + ev[0], ev[3], ev[4], ev[1]);
    });

    // Crash + snare militare
    scheduleCrash(t0, 0.32);
    scheduleTom(t0 + 0.55, 0.28);
    scheduleNoiseDrum(t0 + 1.05, 0.24, 'snare');
    scheduleKick(t0 + 1.40, 0.42);
    scheduleCrash(t0 + 1.40, 0.28);

    // Dopo il jingle, ripristina il loop del livello (se ce n'era uno)
    if (jingleHandle) clearTimeout(jingleHandle);
    jingleHandle = setTimeout(function () {
      jingleHandle = null;
      if (previousTrack) {
        activeTrack = previousTrack;
        activeTrackId = previousId;
        stepIndex = 0;
        nextStepTime = ctx.currentTime + 0.04;
        scheduler();
        schedulerHandle = setInterval(scheduler, 25);
      }
    }, 2700);
  }

  // Helper aggiuntivo per il jingle: schedula correttamente le note.
  // (la fanfara sopra usa scheduleTone, già definita.)

  function unlock() {
    if (!ensureContext()) return Promise.resolve(false);
    if (ctx.state === 'running' || !ctx.resume) {
      afterResume();
      return Promise.resolve(true);
    }
    return ctx.resume().then(function () {
      afterResume();
      return ctx.state === 'running';
    }).catch(function () {
      return false;
    });
  }

  window.AUDIO = {
    unlock: unlock,
    stop: stop,
    playLevelTrack: playLevelTrack,
    playSfx: playSfx,
    setTempoMultiplier: setTempoMultiplier,
    playVictoryJingle: playVictoryJingle,
    getCurrentTrackId: function () { return activeTrackId; },
    getState: function () { return ctx ? ctx.state : 'new'; },
    isSupported: function () { return !!AudioCtx; },
  };
})();
