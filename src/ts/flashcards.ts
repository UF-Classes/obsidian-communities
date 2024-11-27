import {Editor, MarkdownFileInfo, MarkdownView, Modal, Notice, Plugin, setIcon, Setting} from "obsidian";
import {SerializedFlashcardSet} from "./settings";

export class FlashcardSet {
    id: number;  // Unix time created

    constructor(public name: string, public flashcards: Array<Array<string>>, id: number = -1) {  // [front, back]
        if (id === -1) {
            this.id = Date.now();
        }
    }
}

export class FlashcardSetModal extends Modal {
    private flashcardContainerEl: HTMLDivElement;

    constructor(private plugin: Plugin, public flashcardSet: FlashcardSet) {
        super(plugin.app);
        this.setTitle(`Editing Flashcard Set: ${flashcardSet.name}`);

        new Setting(this.contentEl)
            .setName("Flashcard Set Name")
            .addText((text) => {
                text.setValue(flashcardSet.name);
                text.onChange((value) => {
                    flashcardSet.name = value;
                    this.setTitle(`Editing Flashcard Set: ${flashcardSet.name}`);
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
            if (flashcardEl.offsetTop + flashcardEl.clientHeight > this.modalEl.scrollTop + this.modalEl.clientHeight) {
                const nextInserter = flashcardEl.nextElementSibling as HTMLElement;
                this.modalEl.scrollTo({
                    top: nextInserter.offsetTop + nextInserter.clientHeight - this.modalEl.clientHeight,
                    behavior: "smooth"
                });
            }
        });
        return button;
    }

    onClose() {
        if (Flashcards.instance.options.onSetSaved)
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
                            Flashcards.instance.openFlashcardEditorModal(flashcardSet as FlashcardSet);
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

    onCreateFlashcardSetCommand(editor: Editor, _: MarkdownView | MarkdownFileInfo) {
        let selectedText = editor.getSelection();
        if (!selectedText) {
            this.openFlashcardEditorModal(new FlashcardSet("My Flashcard Set", [["", ""]]));
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
        this.openFlashcardEditorModal(new FlashcardSet("My Flashcard Set", flashcards));
        return;
    }

    openFlashcardEditorModal(flashcardSet: FlashcardSet) {
        const modal = new FlashcardSetModal(this.plugin, flashcardSet);
        modal.open();
    }
}