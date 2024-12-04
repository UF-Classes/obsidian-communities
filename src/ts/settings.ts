export interface SerializedFlashcardSet {
    name: string;
    id: number;  // Unix time created
    flashcards: Array<Array<string>>;
}

export default interface CommunitiesSettings {
    flashcardSets: Array<SerializedFlashcardSet>
}

export const DEFAULT_SETTINGS: Partial<CommunitiesSettings> = {
    flashcardSets: []
}