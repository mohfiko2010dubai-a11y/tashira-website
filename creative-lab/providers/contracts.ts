export type MediaResult = {
  provider: string;
  assetPath: string;
  requestId?: string;
  durationMs?: number;
};

export interface ImageProvider {
  generate(input: { prompt: string; aspectRatio: "1:1" | "9:16" }): Promise<MediaResult>;
}

export interface VideoProvider {
  generate(input: { prompt: string; durationSeconds: number; aspectRatio: "9:16" }): Promise<MediaResult>;
}

export interface VoiceProvider {
  generate(input: { script: string; locale: string; voice?: string }): Promise<MediaResult>;
}

export interface RenderProvider {
  compose(input: {
    briefId: string;
    mediaPaths: string[];
    logoPath: string;
    subtitles?: string[];
    outputPath: string;
  }): Promise<MediaResult>;
}

