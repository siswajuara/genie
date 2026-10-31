export const STATUSES = [
  "Backlog",
  "Researching",
  "Scripting",
  "Review",
  "Ready to shoot",
  "Editing",
  "Scheduled",
  "Published",
] as const;
export type Status = (typeof STATUSES)[number];
export const FRAMEWORKS = {
  HCIA: {
    name: "HCIA",
    full: "Hook · Context · Insight · Action",
    beats: ["Hook", "Context", "Insight", "Action"],
    description: "Bedah kasus dan fenomena yang sedang ramai.",
    hints: [
      "Pancing rasa penasaran di 3 detik pertama.",
      "Ceritakan konteks secara singkat.",
      "Bedah dengan ilmu dan penjelasan yang relevan.",
      "Ajak penonton berdiskusi atau mencoba.",
    ],
    color: "orange",
  },
  PAS: {
    name: "PAS",
    full: "Problem · Agitate · Solve",
    beats: ["Problem", "Agitate", "Solve"],
    description: "Ubah kesulitan sehari-hari menjadi solusi praktis.",
    hints: [
      "Kenali masalah nyata penonton.",
      "Jelaskan dampaknya tanpa menakut-nakuti.",
      "Berikan solusi yang bisa diterapkan.",
    ],
    color: "purple",
  },
  BAB: {
    name: "BAB",
    full: "Before · After · Bridge",
    beats: ["Before", "After", "Bridge"],
    description: "Tunjukkan perubahan dan jembatani pemahaman.",
    hints: [
      "Tunjukkan kondisi awal atau miskonsepsi.",
      "Gambarkan hasil atau pemahaman yang benar.",
      "Jelaskan langkah penghubungnya.",
    ],
    color: "green",
  },
  TIE: {
    name: "TIE",
    full: "Trend · Insight · Educate",
    beats: ["Trend", "Insight", "Educate"],
    description: "Temukan pelajaran di balik sebuah tren.",
    hints: [
      "Perkenalkan tren yang sudah diverifikasi.",
      "Temukan sudut pandang keilmuan.",
      "Bagikan prinsip dan penerapannya.",
    ],
    color: "blue",
  },
  Debunking: {
    name: "Sanggahan mitos",
    full: "Klaim · Patahan · Bukti · Pelajaran",
    beats: ["Klaim", "Patahan", "Bukti", "Pelajaran"],
    description: "Luruskan miskonsepsi dengan bukti dan logika.",
    hints: [
      "Tampilkan klaim dengan konteks yang jelas.",
      "Sanggah secara ramah dan tegas.",
      "Jelaskan bukti yang dapat diperiksa.",
      "Rangkum pelajaran yang mudah diingat.",
    ],
    color: "pink",
  },
} as const;
export type Framework = keyof typeof FRAMEWORKS;
export interface Question {
  id: string;
  number: number;
  subject: string;
  grade: string;
  level: string;
  package: string;
  type: string;
  topic: string;
  stem: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
  illustration: string;
  framework: Framework;
  script: string;
  source: string;
}
export interface Reference {
  id: string;
  title: string;
  url: string;
  notes: string;
  image?: string;
}
export interface Task {
  id: string;
  number: number;
  title: string;
  subject: string;
  segment: string;
  framework: Framework;
  status: Status;
  priority: string;
  owner: string;
  platform: string;
  dueDate: string;
  questionIds: string[];
  referenceId: string;
  script: Record<string, string>;
  caption: string;
  hashtags: string;
  checks: { visual: boolean; answer: boolean; caption: boolean };
  visualNotes: string;
  accuracyNotes: string;
  target: string;
  format: string;
  duration: string;
  source: string;
  aiDraft: boolean;
  aiHistory: { prompt: string; output: string; model: string; date: string }[];
  canvasLink?: { projectId: string; pageId: string; frameIds: string[] };
  createdAt: string;
  updatedAt: string;
}
export interface StudioData {
  tasks: Task[];
  questions: Question[];
  references: Reference[];
  settings: { model: string };
  aiAvailable: boolean;
}
