import type { WeddingEvent } from '~/types/wedding'

export const wedding: WeddingEvent = {
  couple: {
    bride: {
      firstName: 'Sabrina',
      fullName: 'Sabrina de Palma',
    },
    groom: {
      firstName: 'Ottavio',
      fullName: 'Ottavio Fogliata',
    },
    displayName: 'Ottavio e Sabrina',
  },
  date: {
    iso: '2026-09-12T16:30:00+02:00',
    dayName: 'Sabato',
    day: '12',
    month: 'settembre',
    year: '2026',
    time: '16:30',
    display: 'Sabato 12 settembre 2026',
    calendarUrl: '/invito-ottavio-sabrina.ics',
  },
  ceremony: {
    label: 'Cerimonia',
    name: 'Chiesa Santa Famiglia da Nazareth',
    address: 'Viale della Libertà',
    city: '74015 Martina Franca (TA)',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Chiesa%20Santa%20Famiglia%20da%20Nazareth%20Viale%20della%20Libert%C3%A0%20Martina%20Franca',
    detailsUrl: 'https://parrocchiasantafamiglia.altervista.org/',
  },
  reception: {
    label: 'Ricevimento',
    name: 'Masseria Luco',
    address: 'Via Noci Zona D, n. 121',
    city: '74015 Martina Franca (TA)',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Masseria%20Luco%20Via%20Noci%20Zona%20D%20121%20Martina%20Franca',
    detailsUrl: 'https://www.masserialuco.it/',
  },
  invitation: {
    eyebrow: 'Ci sposiamo!',
    headline: 'Ci farebbe davvero piacere averti con noi nel giorno del nostro matrimonio',
    body: 'Vorremmo condividere con te la cerimonia a Martina Franca e poi continuare la festa insieme a Masseria Luco.',
    deadlineLead: 'Rispondi al nostro invito entro il 15 luglio.',
    deadlineDetail: 'Bastano 30 secondi per aiutarci a organizzare tutto al meglio.',
  },
  rsvp: {
    label: 'Rispondi',
    ariaLabel: 'Conferma la tua presenza al matrimonio',
    href: 'https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=Wft223ejIEG8VFnerX05yfdbgs2R8chNqU01r-t0EOVUOVdQT00wN1dDTjdRMVVBTEpaQjdRME1aQy4u',
  },
  minigame: {
    label: 'Gioca',
    ariaLabel: 'Apri il minigioco di Ottavio e Sabrina',
    href: '/minigame/super.html',
  },
}
