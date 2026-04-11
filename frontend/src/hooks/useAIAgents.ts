import { useMutation } from "@tanstack/react-query";
import axios from "axios";

export function useResearchAgent() {
  return useMutation({
    mutationFn: async ({ topic, contextLength }: { topic: string; contextLength?: number }) => {
      const response = await axios.post("/api/v1/ai/agents/research", {
        topic,
        context_length: contextLength || 2000,
      });
      return response.data;
    },
  });
}

export function useFactCheckAgent() {
  return useMutation({
    mutationFn: async ({ text, domain }: { text: string; domain?: string }) => {
      const response = await axios.post("/api/v1/ai/agents/fact-check", {
        text,
        knowledge_domain: domain || "general",
      });
      return response.data;
    },
  });
}

export function useToneAnalyzeAgent() {
  return useMutation({
    mutationFn: async ({
      text,
      genre,
      projectType,
    }: {
      text: string;
      genre?: string;
      projectType?: string;
    }) => {
      const response = await axios.post("/api/v1/ai/agents/tone-analyze", {
        text,
        genre: genre || "novel",
        project_type: projectType || "novel",
      });
      return response.data;
    },
  });
}

export function useCitationAgent() {
  return useMutation({
    mutationFn: async ({
      researchResults,
      citationStyle,
    }: {
      researchResults: string;
      citationStyle?: "APA" | "MLA" | "Chicago" | "Harvard";
    }) => {
      const response = await axios.post("/api/v1/ai/agents/cite", {
        research_results: researchResults,
        citation_style: citationStyle || "APA",
      });
      return response.data;
    },
  });
}
