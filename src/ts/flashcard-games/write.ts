import {ItemView, WorkspaceLeaf} from "obsidian";
import {FlashcardSet} from "../flashcards";

export const VIEW_TYPE_FLASHCARD_WRITE_GAME = "flashcard-write-game";

export class FlashcardWriteGame extends ItemView {
    public icon = "gamepad-2";
    private flashcardSet: FlashcardSet;
    private gameContainer: HTMLDivElement;
    private shuffledFlashcards: Array<Array<string>>;
    private currentFlashcard: Array<string>;
    private numCorrect: number = 0;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getDisplayText(): string {
        return "Flashcard Study Game: Write";
    }

    getViewType(): string {
        return "";
    }

    loadFlashcardSet(flashcardSet: FlashcardSet) {
        this.flashcardSet = flashcardSet;
        this.contentEl.empty();
        this.gameContainer = this.contentEl.createDiv({cls: "flashcard-write-game"});
        this.startGame();
    }

    private startGame() {
        this.gameContainer.empty();
        this.gameContainer.innerHTML = `
            <div class="flashcard-write-game__top-bar">
                <span class="flashcard-write-game__score">Correct: 0</span>
                <span class="flashcard-write-game__remaining">Remaining: ${this.flashcardSet.flashcards.length}</span>
                <button class="flashcard-write-game__restart">Restart</button>
            </div>
            <div class="flashcard-write-game__result" style="display: none">
                <span class="flashcard-write-game__result-text"></span>
                <br>
                <span class="flashcard-write-game__result-answer"></span>
                <button class="flashcard-write-game__result-change"></button>
            </div>
            <div class="flashcard-write-game__current-question">
                <span class="flashcard-write-game__question"></span>
                <input class="flashcard-write-game__answer" type="text">
            </div>
        `;
        this.shuffledFlashcards = this.shuffleArray(this.flashcardSet.flashcards.slice());
        this.numCorrect = 0;
        const answerInputEl = this.contentEl.querySelector(".flashcard-write-game__answer") as HTMLInputElement;
        answerInputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                this.checkAnswer(answerInputEl.value);
                this.nextQuestion();
            }
        });
        const resultChangeBtn = this.contentEl.querySelector(".flashcard-write-game__result-change");
        resultChangeBtn.addEventListener("click", () => {
            const resultTextEl = this.contentEl.querySelector(".flashcard-write-game__result-text");

            if (resultTextEl.textContent === "Correct!") {
                resultTextEl.textContent = "Incorrect!";
                resultChangeBtn.textContent = "Actually, I was correct";
                this.numCorrect--;
            } else if (resultTextEl.textContent === "Incorrect!") {
                resultTextEl.textContent = "Correct!";
                this.numCorrect++;
                resultChangeBtn.textContent = "Actually, I was incorrect";
            }
            this.updateScore();
        });
        this.contentEl.querySelector(".flashcard-write-game__restart").addEventListener("click", () => {
            this.startGame();
            return;
        });
        this.nextQuestion();
    }

    private checkAnswer(answer: string) {
        const resultEl = this.contentEl.querySelector(".flashcard-write-game__result") as HTMLDivElement;
        const resultTextEl = this.contentEl.querySelector(".flashcard-write-game__result-text") as HTMLSpanElement;
        const answerEl = this.contentEl.querySelector(".flashcard-write-game__result-answer") as HTMLSpanElement;
        const changeEl = this.contentEl.querySelector(".flashcard-write-game__result-change") as HTMLButtonElement;
        answerEl.innerHTML = `Correct answer: ${this.currentFlashcard[1]}<br>(Your answer: ${answer})`;
        if (answer.trim().toLowerCase() === this.currentFlashcard[1].trim().toLowerCase()) {
            resultTextEl.innerHTML = "Correct!";
            this.numCorrect++;
            changeEl.innerHTML = "Actually, I was incorrect"
        } else {
            resultTextEl.innerHTML = "Incorrect!";
            changeEl.innerHTML = "Actually, I was correct"
        }
        resultEl.style.display = "block";
        this.updateScore();
    }

    private nextQuestion() {
        const answerInputEl = this.contentEl.querySelector(".flashcard-write-game__answer") as HTMLInputElement;
        answerInputEl.value = "";
        const remainingEl = this.contentEl.querySelector(".flashcard-write-game__remaining");
        remainingEl.textContent = `Remaining: ${this.shuffledFlashcards.length}`;
        this.currentFlashcard = this.shuffledFlashcards.pop();
        if (this.currentFlashcard === undefined) {
            this.endGame();
            return;
        }
        const questionEl = this.contentEl.querySelector(".flashcard-write-game__question");
        questionEl.textContent = this.currentFlashcard[0];
    }

    private endGame() {
        const currentQuestionEl = this.contentEl.querySelector(".flashcard-write-game__current-question") as HTMLDivElement;
        currentQuestionEl.style.display = "none";
    }

    private updateScore() {
        const scoreEl = this.contentEl.querySelector(".flashcard-write-game__score");
        scoreEl.textContent = `Correct: ${this.numCorrect}`;
    }

    private shuffleArray<T>(array: Array<T>) : Array<T> {
        for (let i = array.length - 1; i >= 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}