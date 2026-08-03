export interface WriterSection {
  heading: string;
  content: string;
}

export interface WriterOutput {
  title: string;
  summary: string;
  sections: WriterSection[];
  keyMessages: string[];
  riskNote: string;
  confidence: number;
}
