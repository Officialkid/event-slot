export const FAQ_SUGGESTIONS: Record<string, { question: string }[]> = {
  CONFERENCE: [
    { question: 'Is there parking available at the venue?' },
    { question: 'What is the dress code for this event?' },
    { question: 'Will meals or refreshments be provided?' },
    { question: 'Will the sessions be recorded or livestreamed?' },
    { question: 'Is there a certificate of attendance?' },
    { question: 'Can I transfer my registration to someone else?' },
  ],
  WORKSHOP: [
    { question: 'What should I bring to the workshop?' },
    { question: 'Is there a prerequisite skill level required?' },
    { question: 'Will materials be provided or should I bring my own?' },
    { question: 'What is the dress code?' },
    { question: 'Will lunch or snacks be provided?' },
    { question: 'Is there a certificate upon completion?' },
  ],
  NETWORKING: [
    { question: 'What is the dress code?' },
    { question: 'Is there parking at the venue?' },
    { question: 'Will food and drinks be served?' },
    { question: 'Can I bring a colleague or friend?' },
    { question: 'Is this event open to specific industries only?' },
  ],
  CHURCH: [
    { question: 'What time should I arrive?' },
    { question: 'Is there a dress code?' },
    { question: 'Is the event family-friendly? Can I bring children?' },
    { question: 'Is there transportation available?' },
    { question: 'Will there be a physical offering?' },
    { question: 'What language will the service be conducted in?' },
  ],
  CAMPUS: [
    { question: 'Is this event open to students from other institutions?' },
    { question: 'Is there a fee at the gate?' },
    { question: 'What should I carry?' },
    { question: 'Is there food available at the venue?' },
    { question: 'What time does it end?' },
    { question: 'Can I come with a friend who is not a student?' },
  ],
  CONCERT: [
    { question: 'Is the ticket transferable or refundable?' },
    { question: 'What time do doors open?' },
    { question: 'Is there an age restriction?' },
    { question: 'What items are not allowed into the venue?' },
    { question: 'Is there parking at the venue?' },
    { question: 'Will there be a VIP section?' },
  ],
  VIRTUAL: [
    { question: 'What platform will the event be on?' },
    { question: 'Will I receive the link before the event?' },
    { question: 'Will the session be recorded?' },
    { question: 'What time zone is the event time in?' },
    { question: 'Do I need to install any software?' },
    { question: 'Can I participate from my phone?' },
  ],
  DEFAULT: [
    { question: 'Is there parking available at the venue?' },
    { question: 'What is the dress code?' },
    { question: 'Will food or refreshments be provided?' },
    { question: 'Can I bring a guest?' },
    { question: 'What time should I arrive?' },
    { question: 'Will there be a certificate or proof of attendance?' },
  ],
}

export function getSuggestionsForCategory(category: string): { question: string }[] {
  return FAQ_SUGGESTIONS[category?.toUpperCase()] ?? FAQ_SUGGESTIONS.DEFAULT
}
