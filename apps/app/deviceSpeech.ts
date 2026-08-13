import * as Speech from "expo-speech";
import type { SpeechAdapter } from "./communicatorSession";

export const deviceSpeech: SpeechAdapter = {
  speak(text: string) {
    Speech.speak(text);
  },
  cancel() {
    Speech.stop();
  },
};
