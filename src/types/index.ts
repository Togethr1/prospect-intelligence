export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface User {
  id: string;
  email: string;
  created_at: string;
}

// -- Persona / Practice Coach Definitions --

export interface PersonalityConfig {
  jobTitle: string;
  industry: string;
  scenario?: string;
  personalityType: 'Skeptical' | 'Busy' | 'Friendly' | 'Analytical' | 'Aggressive' | string;
  keyObjections: string[]; // List of objections they are likely to raise
  buyingCriteria: string[]; // What they need to hear to buy
  tone?: string; // e.g., "Professional", "Casual", "Rushed"
  voiceGender?: 'man' | 'woman';
  voiceTone?: string;
}

export interface Persona {
  id: string;
  name: string;
  personality_config: PersonalityConfig;
  created_at: string;
}

// -- Session / Simulation Definitions --

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ScorecardMetric {
  score: number; // 1-10
  feedback: string;
}

export interface Scorecard {
  objectionHandlingScore: number; // 1-10
  empathyScore: number; // 1-10
  pacingScore: number; // 1-10 (Likert scale or simple grade)

  evaluationSummary: {
    strengths: string[]; // 3 bullet points
    improvements: string[]; // 3 bullet points
  };

  overallFeedback?: string;
  isPass?: boolean;
}

export interface Session {
  id: string;
  persona_id: string;
  transcript: Message[];
  scorecard: Scorecard | null;
  duration_seconds: number;
  created_at: string;

  // Optional: Link to the Persona snapshot used for this session
  // in case the persona changes later.
  personaSnapshot?: Persona;
}

// -- Knowledge Base / RAG Definitions --

export interface KnowledgeBaseItem {
  id: string;
  content: string;
  metadata: {
    source?: string; // URL or Filename
    page?: number;
    title?: string;
    type?: 'web_scrape' | 'pdf_upload' | 'text_input';
    createdAt?: string;
  };
  embedding?: number[]; // Usually not needed in frontend, but good to know it exists
  created_at: string;
}

// -- Live Assistant / Knowledge Base --

export interface ServiceOffering {
  id: string;
  name: string;
  value_proposition: string;
  target_audience: string;
  pain_points: string[];
  created_at: string;
}

export interface LiveIntel {
  targetUrl: string;
  decisionMakers: string[];
  companyMission: string;
  recentNews: {
    title: string;
    url: string;
    date?: string;
  }[];
  painPoints: string[]; // Inferred from keywords like "hiring", "bad reviews"
}
