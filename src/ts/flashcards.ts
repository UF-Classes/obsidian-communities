import {
    Editor,
    ItemView,
    MarkdownFileInfo,
    MarkdownView,
    Modal,
    Plugin,
    setIcon,
    Setting,
    WorkspaceLeaf
} from "obsidian";
import {SerializedFlashcardSet} from "./settings";

export class FlashcardSet {
    id: number;  // Unix time created

    constructor(public name: string, public flashcards: Array<Array<string>>, id: number = -1) {  // [front, back]
        if (id === -1) {
            this.id = Date.now();
        }
    }
}

export const VIEW_TYPE_FLASHCARD_SET = "flashcard-set";

export class FlashcardSetView extends ItemView {
    private flashcardContainerEl: HTMLDivElement;
    public flashcardSet: FlashcardSet;
    public icon = "notepad-text";
    public navigation = true;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_FLASHCARD_SET;
    }

    getDisplayText() {
        return "Flashcard Set";
    }

    loadFlashcardSet(flashcardSet: FlashcardSet) {
        this.flashcardSet = flashcardSet;
        this.setState({flashcardSet: flashcardSet}, {history: true}).then(() => {});
        this.contentEl.empty();

        const titleEl = this.contentEl.createEl("h3", { text: `Editing Flashcard Set: ${flashcardSet.name}` });

        new Setting(this.contentEl)
            .setName("Flashcard Set Name")
            .addText((text) => {
                text.setValue(flashcardSet.name);
                text.onChange((value) => {
                    flashcardSet.name = value;
                    titleEl.setText(`Editing Flashcard Set: ${flashcardSet.name}`);
                });
            });
        this.contentEl.createEl("h4", {text: "Flashcards"});
        this.flashcardContainerEl = this.contentEl.createEl("div", {cls: "flashcards__container"});

        for (let i = 0; i < flashcardSet.flashcards.length; i++) {
            this.createFlashcardInserter();
            this.createFlashcardSettingEl(flashcardSet.flashcards[i]);
        }
        this.createFlashcardInserter();
    }

    createFlashcardSettingEl(flashcardData: Array<string>) {
        let [front, back] = flashcardData;
        const setting = new Setting(this.flashcardContainerEl)
            .setClass("flashcard--edit")
            .addText((text) => {
                text.setValue(front);
                text.onChange((value) => {
                    flashcardData[0] = value;
                });
            })
            .addTextArea((text) => {
                text.setValue(back);
                setTimeout(() => {
                    text.inputEl.style.height = text.inputEl.scrollHeight + 'px';
                }, 0);
                text.onChange((value) => {
                    flashcardData[1] = value;
                });
            })
            .addButton((button) => {  // Remove flashcard button
                button
                    .setIcon("trash-2")
                    .setCta()
                    .onClick(() => {
                        const inserter = setting.settingEl.previousElementSibling as HTMLElement;
                        inserter.remove();
                        this.flashcardSet.flashcards.splice(this.flashcardSet.flashcards.indexOf(flashcardData), 1);
                        setting.settingEl.remove();
                    });
            });
        const settingEl = setting.settingEl as HTMLElement & {flashcardData: Array<string>};
        settingEl.flashcardData = flashcardData;
        return setting;
    }

    createFlashcardInserter() {
        const button = this.flashcardContainerEl.createEl("button", {
            cls: "flashcards__insert"
        });
        setIcon(button, "circle-plus");
        button.addEventListener("click", () => {
            const prevFlashcardEl = button.previousElementSibling as HTMLElement & {flashcardData: Array<string>};
            const idx = prevFlashcardEl ? this.flashcardSet.flashcards.indexOf(prevFlashcardEl.flashcardData) + 1 : 0;
            this.flashcardSet.flashcards.splice(idx, 0, ["", ""]);
            const newInserter = this.createFlashcardInserter();
            const flashcardEl = this.createFlashcardSettingEl(this.flashcardSet.flashcards[idx]).settingEl;
            this.flashcardContainerEl.insertBefore(flashcardEl, button);
            this.flashcardContainerEl.insertBefore(newInserter, flashcardEl);
            // Scroll to new flashcard
            if (flashcardEl.offsetTop + flashcardEl.clientHeight > this.contentEl.scrollTop + this.contentEl.clientHeight) {
                const nextInserter = flashcardEl.nextElementSibling as HTMLElement;
                console.log(this.contentEl);
                this.contentEl.scrollTo({
                    top: nextInserter.offsetTop + nextInserter.clientHeight - this.contentEl.clientHeight,
                    behavior: "smooth"
                });
            }
        });
        return button;
    }

    async onOpen() {
        return;
    }

    async onClose() {
        if (Flashcards.instance.options.onSetSaved && this.flashcardSet)
            Flashcards.instance.options.onSetSaved(this.flashcardSet);
    }
}

export class AllFlashcardsModal extends Modal {
    constructor(private plugin: Plugin, private flashcardSets: Array<SerializedFlashcardSet>) {
        super(plugin.app);
        this.setTitle("All Flashcard Sets");

        this.contentEl.createEl("h4", {text: "Flashcard Sets"});
        for (const flashcardSet of flashcardSets) {
            const setting = new Setting(this.contentEl)
                .setName(flashcardSet.name)
                .setDesc(flashcardSet.flashcards.length + " flashcards, created " + new Date(flashcardSet.id).toLocaleString())
                .addButton((button) => {
                    button
                        .setIcon("pencil")
                        .setCta()
                        .onClick(() => {
                            Flashcards.instance.openFlashcardSetView(flashcardSet as FlashcardSet);
                        });
                })
                .addButton((button) => {
                   button
                      .setIcon("trash-2")
                      .setCta()
                      .onClick(() => {
                          // Prompt confirmation


                          if (Flashcards.instance.options.onSetDeleted)
                              Flashcards.instance.options.onSetDeleted(flashcardSet as FlashcardSet);
                          setting.settingEl.remove();
                      });
                });
        }
    }
}

interface FlashcardsOptions {
    serializedFlashcardSets: Array<SerializedFlashcardSet>;
    onSetSaved?: (flashcardSet: FlashcardSet) => void;
    onSetDeleted?: (flashcardSet: FlashcardSet) => void;
}

export default class Flashcards {
    static instance: Flashcards;

    constructor(private plugin: Plugin, public options: FlashcardsOptions) {
        if (Flashcards.instance) {
            return Flashcards.instance;
        }
        Flashcards.instance = this;

        plugin.registerView(VIEW_TYPE_FLASHCARD_SET, (leaf) => new FlashcardSetView(leaf));

        plugin.addCommand({
            id: "create-flashcard-set",
            name: "Create Flashcard Set",
            editorCallback: this.onCreateFlashcardSetCommand.bind(this),
        });

        plugin.addCommand({
            id: "view-all-flashcard-sets",
            name: "View All Flashcard Sets",
            callback: () => {
                new AllFlashcardsModal(plugin, options.serializedFlashcardSets).open();
            }
        })
    }

    async onCreateFlashcardSetCommand(editor: Editor, _: MarkdownView | MarkdownFileInfo) {
        let selectedText = editor.getSelection();
        if (!selectedText) {
            await this.openFlashcardSetView(new FlashcardSet("My Flashcard Set", [["", ""]]));
            return;
        }
        // Parse selectedText into flashcards
        const flashcards: Array<Array<string>> = [];
        // const regex = /(\w.*):(.+)(?:$|\n)/;
        const regex = /((\w.*):((?:.(?!:)|\n)+))\n.+:/;
        const lastCardRegex = /((\w.*):((?:.|\n)+))(?:\n|$)/
        while (true) {
            let match = regex.exec(selectedText);
            if (!match) {
                match = lastCardRegex.exec(selectedText);
                if (!match)
                    break;
            }
            flashcards.push([match[2].trim(), match[3].trim()]);
            selectedText = selectedText.slice(match.index + match[1].length);
        }
        await this.openFlashcardSetView(new FlashcardSet("My Flashcard Set", flashcards));
        return;
    }

    async openFlashcardSetView(flashcardSet: FlashcardSet) {
        const { workspace } = this.plugin.app;
        let leaf: WorkspaceLeaf = workspace.getLeaf("tab");
        await leaf.setViewState({
            type: VIEW_TYPE_FLASHCARD_SET,
            active: true
        });
        await workspace.revealLeaf(leaf);
        (leaf.view as FlashcardSetView).loadFlashcardSet(flashcardSet);
    }
}