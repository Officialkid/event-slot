export type TemplateQuestion = {
  id: string
  label: string
  type: "text" | "email" | "phone" | "select" | "checkbox"
  required: boolean
  options?: string[]
  allowMultiple?: boolean
}

export type EventTemplate = {
  id: string
  name: string
  icon: string
  description: string
  questions: TemplateQuestion[]
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: "community-meetup",
    name: "Community Meetup",
    icon: "👥",
    description: "Casual gathering for a community or group.",
    questions: [
      { id: "q1", label: "Phone number", type: "phone", required: false },
      {
        id: "q2",
        label: "How did you hear about this event?",
        type: "select",
        options: ["Social media", "Friend / Word of mouth", "Email newsletter", "Community group", "Other"],
        required: false,
      },
    ],
  },
  {
    id: "corporate-training",
    name: "Corporate Training",
    icon: "🏢",
    description: "Professional training session or workshop.",
    questions: [
      { id: "q1", label: "Job title", type: "text", required: false },
      { id: "q2", label: "Company / Organisation name", type: "text", required: false },
      { id: "q3", label: "Department / Team", type: "text", required: false },
    ],
  },
  {
    id: "workshop",
    name: "Workshop",
    icon: "🛠️",
    description: "Hands-on skills workshop or class.",
    questions: [
      {
        id: "q1",
        label: "Experience level",
        type: "select",
        options: ["Beginner", "Intermediate", "Advanced"],
        required: false,
      },
      {
        id: "q2",
        label: "What do you hope to learn?",
        type: "text",
        required: false,
      },
    ],
  },
  {
    id: "conference",
    name: "Conference",
    icon: "🎤",
    description: "Large conference or summit.",
    questions: [
      { id: "q1", label: "Organisation / Affiliation", type: "text", required: false },
      { id: "q2", label: "Job title", type: "text", required: false },
      {
        id: "q3",
        label: "Dietary requirements",
        type: "select",
        options: ["None", "Vegetarian", "Vegan", "Halal", "Gluten-free", "Other"],
        required: false,
      },
      {
        id: "q4",
        label: "T-shirt size",
        type: "select",
        options: ["XS", "S", "M", "L", "XL", "XXL"],
        required: false,
      },
    ],
  },
  {
    id: "church-event",
    name: "Church / Faith Event",
    icon: "⛪",
    description: "Church service, crusade, or faith-based gathering.",
    questions: [
      { id: "q1", label: "Phone number", type: "phone", required: false },
      {
        id: "q2",
        label: "Are you a first-time visitor?",
        type: "select",
        options: ["Yes", "No"],
        required: false,
      },
    ],
  },
  {
    id: "blank",
    name: "Start from scratch",
    icon: "✏️",
    description: "Build your own form from zero.",
    questions: [],
  },
]
