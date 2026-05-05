<script setup lang="ts">
import EventDetails from '~/components/sections/EventDetails.vue'
import FinalCta from '~/components/sections/FinalCta.vue'
import InvitationIntro from '~/components/sections/InvitationIntro.vue'
import MinigameTeaser from '~/components/sections/MinigameTeaser.vue'
import VenueSpotlight from '~/components/sections/VenueSpotlight.vue'
import WeddingHero from '~/components/sections/WeddingHero.vue'
import SiteHeader from '~/components/layout/SiteHeader.vue'
import { wedding } from '~/data/wedding'
</script>

<template>
  <main class="wedding-page">
    <SiteHeader />
    <WeddingHero :event="wedding" />
    <InvitationIntro :event="wedding" />
    <EventDetails :event="wedding" />
    <VenueSpotlight :venue="wedding.reception" />
    <MinigameTeaser :event="wedding" />
    <FinalCta :event="wedding" />
  </main>
</template>
