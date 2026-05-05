export interface WeddingPerson {
  readonly firstName: string
  readonly fullName: string
}

export interface WeddingVenue {
  readonly label: string
  readonly name: string
  readonly address: string
  readonly city: string
  readonly mapUrl: string
  readonly detailsUrl?: string
}

export interface WeddingEvent {
  readonly couple: {
    readonly bride: WeddingPerson
    readonly groom: WeddingPerson
    readonly displayName: string
  }
  readonly date: {
    readonly iso: string
    readonly dayName: string
    readonly day: string
    readonly month: string
    readonly year: string
    readonly time: string
    readonly display: string
    readonly calendarUrl: string
  }
  readonly ceremony: WeddingVenue
  readonly reception: WeddingVenue
  readonly invitation: {
    readonly eyebrow: string
    readonly headline: string
    readonly body: string
    readonly deadlineLead: string
    readonly deadlineDetail: string
  }
  readonly rsvp: {
    readonly label: string
    readonly ariaLabel: string
    readonly href: string
  }
  readonly minigame: {
    readonly label: string
    readonly ariaLabel: string
    readonly href: string
  }
}
