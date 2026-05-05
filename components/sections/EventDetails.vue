<script setup lang="ts">
import ChurchSilhouetteIcon from '~/components/art/ChurchSilhouetteIcon.vue'
import DateHeartIcon from '~/components/art/DateHeartIcon.vue'
import MasseriaSilhouetteIcon from '~/components/art/MasseriaSilhouetteIcon.vue'
import SectionLabel from '~/components/ui/SectionLabel.vue'
import TextLink from '~/components/ui/TextLink.vue'
import type { WeddingEvent, WeddingVenue } from '~/types/wedding'

defineProps<{
  event: WeddingEvent
}>()

const venueAddress = (venue: WeddingVenue) => `${venue.address}, ${venue.city}`
</script>

<template>
  <section id="details" class="details" aria-label="Dove e quando">
    <div class="details__heading">
      <SectionLabel text="Dove e quando" />
    </div>

    <div class="details__grid">
      <article class="details-card details-card--date">
        <div class="details-card__head">
          <DateHeartIcon class="details-card__icon" />
          <p>Quando</p>
        </div>
        <h3>
          <span>{{ event.date.day }} {{ event.date.month }} {{ event.date.year }}</span>
          <span>ore {{ event.date.time }}</span>
        </h3>
        <a class="details-card__calendar" :href="event.date.calendarUrl" download>
          Aggiungi al calendario
        </a>
      </article>

      <article class="details-card details-card--ceremony">
        <div class="details-card__head">
          <ChurchSilhouetteIcon class="details-card__icon details-card__icon--church" />
          <p>{{ event.ceremony.label }}</p>
        </div>
        <h3>{{ event.ceremony.name }}</h3>
        <span>{{ venueAddress(event.ceremony) }}</span>
        <TextLink :href="event.ceremony.mapUrl" label="Apri la mappa" />
      </article>

      <article class="details-card details-card--reception">
        <div class="details-card__head">
          <MasseriaSilhouetteIcon class="details-card__icon details-card__icon--masseria" />
          <p>{{ event.reception.label }}</p>
        </div>
        <h3>{{ event.reception.name }}</h3>
        <span>{{ venueAddress(event.reception) }}</span>
        <TextLink :href="event.reception.mapUrl" label="Apri la mappa" />
      </article>
    </div>
  </section>
</template>

<style scoped>
.details {
  padding: clamp(5rem, 10vw, 9rem) var(--page-gutter);
  background: linear-gradient(180deg, var(--color-sage-pale) 0%, color-mix(in srgb, var(--color-stone) 88%, var(--color-ivory)) 100%);
}

.details__heading {
  width: min(100%, 1080px);
  margin: 0 auto clamp(2rem, 5vw, 4rem);
}

.details__grid {
  width: min(100%, 1120px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: color-mix(in srgb, var(--color-accent) 26%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent) 26%, transparent);
}

.details-card {
  min-height: 26rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: clamp(1.4rem, 3.4vw, 3rem);
  background: var(--color-paper);
}

.details-card__head {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.details-card__icon {
  width: 3.25rem;
  height: 3.25rem;
  color: var(--color-accent-deep);
}

.details-card__icon--church,
.details-card__icon--masseria {
  width: 4.9rem;
}

.details-card p,
.details-card span {
  font-family: var(--font-sans);
}

.details-card p {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.details-card h3 {
  margin: 2.2rem 0 1.4rem;
  display: grid;
  gap: 0.18em;
  color: var(--color-sage-dark);
  font-size: clamp(2.5rem, 4.6vw, 4.8rem);
  font-weight: 500;
  line-height: 0.98;
}

.details-card--date h3 span {
  color: #245f38;
  font-family: var(--font-serif);
  font-size: 1.16em;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.details-card > span {
  max-width: 18rem;
  color: var(--color-ink);
  font-size: 1.02rem;
  line-height: 1.6;
}

.details-card .text-link {
  margin-top: auto;
  padding-top: 1.6rem;
}

.details-card__calendar {
  width: fit-content;
  margin-top: auto;
  padding-top: 1.6rem;
  color: var(--color-accent);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.4;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.28em;
}

.details-card__calendar:hover {
  color: var(--color-accent-deep);
}

.details-card__calendar:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 4px;
}

@media (max-width: 900px) {
  .details__grid {
    grid-template-columns: 1fr;
  }

  .details-card {
    min-height: auto;
  }

  .details-card h3 {
    margin-top: 2.6rem;
  }
}
</style>
