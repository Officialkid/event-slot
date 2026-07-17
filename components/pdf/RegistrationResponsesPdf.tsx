import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

// Types
interface QuestionAnswer {
  questionId: string;
  label: string;
  type: string;
  answer: string | null;
}

interface RegistrationEntry {
  index: number;
  total: number;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  registeredAt: string;
  ticketCode: string | null;
  questionAnswers: QuestionAnswer[];
}

interface RegistrationResponsesPdfProps {
  eventTitle: string;
  eventDate: string;
  exportedAt: string;
  registrations: RegistrationEntry[];
}

// Styles
// Mirrors the Google Forms response sheet: white page, grey question labels,
// black answer text, thin dividers, minimal chrome.
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#202124',
  },

  // Top bar, matched to a Google Forms-style header.
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#DADCE0',
  },
  topBarLeft: {
    fontSize: 8,
    color: '#5F6368',
  },
  topBarRight: {
    fontSize: 8,
    color: '#5F6368',
  },

  // Respondent counter, for example "1 / 57".
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  counterLabel: {
    fontSize: 9,
    color: '#5F6368',
  },
  counterValue: {
    fontSize: 9,
    color: '#5F6368',
    fontFamily: 'Helvetica-Bold',
  },

  // Respondent name / identity block
  respondentBlock: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DADCE0',
  },
  respondentName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#202124',
    marginBottom: 4,
  },
  respondentMeta: {
    fontSize: 9,
    color: '#5F6368',
    marginBottom: 2,
  },
  statusBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: '#E6F4EA',
  },
  statusBadgeWaitlist: {
    backgroundColor: '#FEF7E0',
  },
  statusText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#137333',
  },
  statusTextWaitlist: {
    color: '#B06000',
  },

  // Question + answer block
  qaBlock: {
    marginBottom: 18,
  },
  answerCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  questionLabel: {
    fontSize: 9,
    color: '#5F6368',
    marginBottom: 6,
    fontFamily: 'Helvetica',
    letterSpacing: 0.1,
  },
  answerText: {
    fontSize: 10.9,
    color: '#202124',
    lineHeight: 1.72,
    fontFamily: 'Helvetica',
  },
  answerTextCompact: {
    fontSize: 10.7,
    color: '#202124',
    lineHeight: 1.68,
    fontFamily: 'Helvetica',
  },
  answerTextSmall: {
    fontSize: 10.4,
    color: '#202124',
    lineHeight: 1.62,
    fontFamily: 'Helvetica',
  },
  answerTextDense: {
    fontSize: 10,
    color: '#202124',
    lineHeight: 1.58,
    fontFamily: 'Helvetica',
  },
  answerEmpty: {
    fontSize: 11,
    color: '#BDBDBD',
    fontFamily: 'Helvetica-Oblique',
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#DADCE0',
    marginBottom: 20,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#DADCE0',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: '#BDBDBD',
  },
  footerRight: {
    fontSize: 7,
    color: '#BDBDBD',
  },

  // EventSlot branding line (subtle, bottom of identity block)
  brandLine: {
    fontSize: 7,
    color: '#BDBDBD',
    marginTop: 2,
  },
});

function getAnswerTextStyle(answer: string | null) {
  const normalized = (answer ?? '').trim();
  if (normalized.length > 2200) return styles.answerTextDense;
  if (normalized.length > 1200) return styles.answerTextSmall;
  if (normalized.length > 520) return styles.answerTextCompact;
  return styles.answerText;
}

// Single response page
const ResponsePage: React.FC<{ reg: RegistrationEntry; eventTitle: string; exportedAt: string }> = ({
  reg,
  eventTitle,
  exportedAt,
}) => (
  <Page size="A4" style={styles.page}>

    {/* Top bar */}
    <View style={styles.topBar}>
      <Text style={styles.topBarLeft}>{eventTitle}</Text>
      <Text style={styles.topBarRight}>{exportedAt}</Text>
    </View>

    {/* Respondent counter */}
    <View style={styles.counterRow}>
      <Text style={styles.counterLabel}>Response</Text>
      <Text style={styles.counterValue}>{reg.index} / {reg.total}</Text>
    </View>

    {/* Respondent identity */}
    <View style={styles.respondentBlock}>
      <Text style={styles.respondentName}>{reg.name}</Text>
      <Text style={styles.respondentMeta}>{reg.email}</Text>
      {reg.phone && <Text style={styles.respondentMeta}>{reg.phone}</Text>}
      <Text style={styles.respondentMeta}>Registered: {reg.registeredAt}</Text>
      {reg.ticketCode && (
        <Text style={styles.respondentMeta}>Ticket: {reg.ticketCode}</Text>
      )}
      <View style={[styles.statusBadge, reg.status !== 'confirmed' ? styles.statusBadgeWaitlist : {}]}>
        <Text style={[styles.statusText, reg.status !== 'confirmed' ? styles.statusTextWaitlist : {}]}>
          {reg.status.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.brandLine}>EventSlot - eventsslot.com</Text>
    </View>

    {/* Questions and answers */}
    {reg.questionAnswers.length > 0 ? (
      reg.questionAnswers.map((qa, i) => (
        <View key={qa.questionId}>
          <View style={styles.qaBlock}>
            <Text style={styles.questionLabel}>{qa.label}</Text>
            <View style={styles.answerCard}>
              {qa.answer && qa.answer.trim() !== '' ? (
                <Text style={getAnswerTextStyle(qa.answer)}>{qa.answer}</Text>
              ) : (
                <Text style={styles.answerEmpty}>No answer provided</Text>
              )}
            </View>
          </View>
          {i < reg.questionAnswers.length - 1 && (
            <View style={styles.divider} />
          )}
        </View>
      ))
    ) : (
      <View style={styles.qaBlock}>
        <Text style={styles.answerEmpty}>No custom questions for this event.</Text>
      </View>
    )}

    {/* Page footer */}
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Confidential - Personal data protected under Kenya Data Protection Act 2019
      </Text>
      <Text
        style={styles.footerRight}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>

  </Page>
);

const EmptyStatePage: React.FC<{ eventTitle: string; eventDate: string; exportedAt: string }> = ({
  eventTitle,
  eventDate,
  exportedAt,
}) => (
  <Page size="A4" style={styles.page}>
    <View style={styles.topBar}>
      <Text style={styles.topBarLeft}>{eventTitle}</Text>
      <Text style={styles.topBarRight}>{exportedAt}</Text>
    </View>

    <View style={styles.respondentBlock}>
      <Text style={styles.respondentName}>No registrations matched this export</Text>
      <Text style={styles.respondentMeta}>{eventDate}</Text>
      <Text style={styles.brandLine}>EventSlot - eventsslot.com</Text>
    </View>

    <View style={styles.qaBlock}>
      <Text style={styles.answerText}>
        There were no registrations available for the selected export filter at the time this PDF was generated.
      </Text>
    </View>

    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Confidential - Personal data protected under Kenya Data Protection Act 2019
      </Text>
      <Text style={styles.footerRight}>Page 1 of 1</Text>
    </View>
  </Page>
);

// Document
export const RegistrationResponsesPdf: React.FC<RegistrationResponsesPdfProps> = ({
  eventTitle,
  eventDate,
  exportedAt,
  registrations,
}) => (
  <Document
    title={`${eventTitle} - Individual Responses`}
    author="EventSlot"
    subject="Individual registration responses"
  >
    {registrations.length > 0 ? (
      registrations.map((reg) => (
        <ResponsePage
          key={reg.index}
          reg={reg}
          eventTitle={`${eventTitle} - ${eventDate}`}
          exportedAt={exportedAt}
        />
      ))
    ) : (
      <EmptyStatePage
        eventTitle={eventTitle}
        eventDate={eventDate}
        exportedAt={exportedAt}
      />
    )}
  </Document>
);
