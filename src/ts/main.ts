import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf } from 'obsidian';
import "../styles/styles.scss";
import Flashcards from "./flashcards";
import CommunitiesSettings, {DEFAULT_SETTINGS} from "./settings";
// Hub, VIEW_TYPE_HUB;

let accessToken: string = "";

const VIEW_TYPE_HUB = 'hub-view';

export default class Communities extends Plugin {

    static instance: Communities;
    settings: CommunitiesSettings;
    email: string;
    loginStatusEl: HTMLElement;

    static getInstance(): Communities {
        return Communities.instance;
    }

    setEmail(email: string) {
        this.email = email;
    }

    async onload() {
        Communities.instance = this;
        this.email = "Not logged in";

        console.log('loading plugin');
        await this.loadSettings();
        new Flashcards(this, {
            serializedFlashcardSets: this.settings.flashcardSets,
            onSetSaved: (flashcardSet) => {
                const serializedFlashcard = {
                    name: flashcardSet.name,
                    id: flashcardSet.id,
                    flashcards: flashcardSet.flashcards
                }
                let idx = this.settings.flashcardSets.findIndex((set) => set.id === flashcardSet.id);
                if (idx === -1) {
                    this.settings.flashcardSets.push(serializedFlashcard);
                    new Notice("Flashcard set created!");
                } else {
                    this.settings.flashcardSets[idx] = serializedFlashcard;
                    new Notice("Flashcard set updated!");
                }
                this.saveSettings();
            },
            onSetDeleted: (flashcardSet) => {
                this.settings.flashcardSets.splice(this.settings.flashcardSets.findIndex((set) => set.id === flashcardSet.id), 1);
                new Notice("Flashcard set deleted!");
                this.saveSettings();
            }
        });

        this.registerView(
            VIEW_TYPE_HUB,
            (leaf) => new Hub(leaf)
        );

        this.addRibbonIcon('vault', 'Obsidian-Communities-Hub', () => {
            this.activateView();
        });

        this.addStatusBarItem().setText('Obsidian Communities');

        this.loginStatusEl = this.addStatusBarItem();

        this.loginStatusEl.setText(`Currently Logged in as: ${this.email}`);

        this.addCommand({
            id: 'login-page',
            name: 'Login',
             callback: () => {
             	new LoginModal(this.app).open();
            },
            /*
            checkCallback: (checking: boolean) => {
                let leaf = this.app.workspace.activeLeaf;
                if (leaf) {
                    if (!checking) {
                        new LoginModal(this.app).open();
                    }
                    return true;
                }
                return false;
            }
            */
        });

        this.addCommand({
            id: 'register-page',
            name: 'Register',
            callback: () => {
                new RegisterModal(this.app).open();
            },
        });

        this.addCommand({
            id: 'log-out',
            name: 'Logout',
            callback: () => {
                fetch('http://127.0.0.1:8000/auth/jwt/logout', { method: 'POST', })
                    .then((res) => {
                        if(res.status == 401) {
                            new Notice("User not verified");
                        } else if(res.status == 204) {
                            new Notice("Successfully Logged out");
                            this.setEmail("Not logged in");
                            this.loginStatusEl.setText(`Currently Logged in as: ${this.email}`);
                        }
                        return res.json()
                    });
            },
        });

        this.addSettingTab(new SampleSettingTab(this.app, this));
    }

    onunload() {
        console.log('unloading plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /*
    async getDisplayCredentials(): string {
        fetch(`http://127.0.0.1:8000/users/exists/${this.email}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            }})
            .then(res => res.json())
            .then(data => {console.log(data)


        })
    }
    */

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HUB);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_HUB, active: true });
        }

        // "Reveal" the leaf in case it is in a collapsed sidebar
        workspace.revealLeaf(leaf);
    }
}

class Hub extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_HUB;
    }

    getDisplayText() {
        return 'Example view';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('h4', { text: 'Example view' });
    }

    async onClose() {
        // Nothing to clean up.
    }
}

class LoginModal extends Modal {
    email: string = "";
    password: string = "";
    passwordFieldEnabled: boolean = false;
    fieldsEl: HTMLElement;

    constructor(app: App) {
        super(app);
        this.setTitle('Login:');

        this.fieldsEl = this.containerEl.querySelector(".modal").createEl('div', { cls: 'fields' });

        new Setting(this.fieldsEl)
            .setName('Email Address:')
            .addText((text) =>
                text.onChange((value) => {
                    this.email = value;
                }
            )
        );

        new Setting(this.containerEl.querySelector(".modal"))
            .addButton((btn) =>
                btn
                    .setButtonText('Login')
                    .setCta()
                    .onClick(() => {
                        if(this.email != "" && this.email.indexOf("@") != -1) {
                            this.onSubmit();
                        } else {
                            new Notice("Invalid Email Address");
                        }
                    })
            );
    }

    onSubmit() {
        console.log("submitted successfully");
        if(!this.passwordFieldEnabled) {
            fetch(`http://127.0.0.1:8000/users/exists/${this.email}`, {

                headers: {
                    'Content-Type': 'application/json;charset=utf-8'
                }})
                .then(res => res.json())
                .then(data => {console.log(data)

                if(data["exists"]) {
                    new Setting(this.fieldsEl)
                    .setName('Password:')
                    .addText((text) =>
                        text.onChange((value) => {
                            this.password = value;
                  }));
                this.passwordFieldEnabled = true;
                } else {
                    new Notice("User does not exist");
                }
            })
        } else {
            fetch('http://127.0.0.1:8000/auth/jwt/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `username=${this.email}&password=${this.password}`})
                .then(res => res.json())
                .then(data => {console.log(data)

            if(data["detail"]) {
                if(data["detail"] == "LOGIN_BAD_CREDENTIALS") {
                    new Notice("Invalid Credentials");
                } else if(data["detail"] == "LOGIN_USER_NOT_VERIFIED") {
                    new Notice("User not verified");
                }
            } else {
                accessToken = data["access_token"];
                Communities.getInstance().setEmail(this.email);
                Communities.getInstance().loginStatusEl.setText(`Currently Logged in as: ${this.email}`);
                this.onLogin();
                this.close();
            }

            })
        }
    }

    onLogin() {
        //this.app.addStatusBarItem().setText("Currently Logged in as: " + this.email.substring(0, this.email.indexOf("@")));
    }

    onOpen() {
        //let {contentEl} = this;
        //contentEl.setText('Woah!');
    }

    onClose() {
        let {contentEl} = this;
        contentEl.empty();
    }
}

class RegisterModal extends Modal {
    email: string = "";
    password: string = "";
    passwordFieldEnabled: boolean = false;
    fieldsEl: HTMLElement;

    constructor(app: App) {
        super(app);
        this.setTitle('Register:');

        this.fieldsEl = this.containerEl.querySelector(".modal").createEl('div', { cls: 'fields' });

        new Setting(this.fieldsEl)
            .setName('Email Address:')
            .addText((text) =>
                text.onChange((value) => {
                    this.email = value;
                }
            )
        );

        new Setting(this.containerEl.querySelector(".modal"))
            .addButton((btn) =>
                btn
                    .setButtonText('Submit')
                    .setCta()
                    .onClick(() => {
                        if(this.email != "" && this.email.indexOf("@") != -1) {
                            this.onSubmit();
                        } else {
                            new Notice("Invalid Email Address");
                        }
                    })
            );
    }

    onSubmit() {
        console.log("submitted successfully");
        if(!this.passwordFieldEnabled) {
            fetch(`http://127.0.0.1:8000/users/exists/${this.email}`, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json;charset=utf-8'
                }})
                .then(res => res.json())
                .then(data => {console.log(data)

                if(!data["exists"]) {
                    new Setting(this.fieldsEl)
                    .setName('Password:')
                    .addText((text) =>
                        text.onChange((value) => {
                            this.password = value;
                    }));
                    this.passwordFieldEnabled = true;
                } else {
                    new Notice("User already exists");
                }
            })
        } else {
            fetch('http://127.0.0.1:8000/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;charset=utf-8'
                },
                body: JSON.stringify(
                {
                    "email": this.email,
                    "password": this.password
                })
            })
            .then(res => res.json())
            .then(data => {console.log(data)

                if(data["detail"]) {
                    if(data["detail"] == "REGISTER_USER_ALREADY_EXISTS") {
                        new Notice("User already exists");
                    } else {
                        new Notice("Invalid Password (Password must be at least 3 characters)");
                    }
                } else {
                    accessToken = data["access_token"];

                    this.onLogin();
                    this.close();
                }
            })
        }
    }

    onLogin() {

    }

    onOpen() {
        //let {contentEl} = this;
        //contentEl.setText('Woah!');
    }

    onClose() {
        let {contentEl} = this;
        contentEl.empty();
    }
}

class SampleSettingTab extends PluginSettingTab {
    display(): void {
        let {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

        new Setting(containerEl)
            .setName('Setting #1')
            .setDesc('It\'s a secret')
            .addText(text => text.setPlaceholder('Enter your secret')
                .setValue('')
                .onChange((value) => {
                    console.log('Secret: ' + value);
                }));

    }
}