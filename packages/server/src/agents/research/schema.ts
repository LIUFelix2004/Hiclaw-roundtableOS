export interface ResearchFinding {
  theme: string;
  detail: string;
  evidence: string;
  confidence: number;
}

export interface ResearchOutput {
  summary: string;
  findings: ResearchFinding[];
  contradictions: string[];
  uncertainties: string[];
  sources: string[];
  confidence: number;
}
