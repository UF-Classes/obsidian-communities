import { App, Modal, View, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf } from 'obsidian';
import "../styles/styles.scss";
import Flashcards from "./flashcards";
import JSZip from "jszip";
import CommunitiesSettings, {DEFAULT_SETTINGS} from "./settings";
import { user } from "./globals";
// Hub, VIEW_TYPE_HUB;

let accessToken: string = "";

const VIEW_TYPE_HUB = 'hub-view';
const VIEW_TYPE_CONTENT = 'content-view';

export default class Communities extends Plugin {
    isLoggedIn: boolean = false;

    static instance: Communities;
    accToken: string;
    settings: CommunitiesSettings;
    email: string;
    loginStatusEl: HTMLElement;

    static getInstance(): Communities {
        return Communities.instance;
    }

    setEmail(email: string) {
        this.email = email;
        user.email = email;
    }

    getAccToken(): string {
        return this.accToken;
    }

    setAccToken(accToken: string) {
        this.accToken = accToken;
        user.token = accToken;
    }

    async onload() {
        Communities.instance = this;
        this.email = "Not logged in";

        console.log('loading plugin');
        await this.loadSettings();
        /*
        for(const flashcardSet of this.settings.flashcardSets) {
            if(flashcardSet.flashcards == undefined) {
                flashcardSet.flashcards = [];
            }
        }
        */
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

        this.registerView(
            VIEW_TYPE_CONTENT,
            (leaf) => new ContentView(leaf)
        );

        this.addRibbonIcon('vault', 'Obsidian-Communities-Hub', () => {
            if(this.isLoggedIn) {
                this.activateContentView();
                return;
            }
            this.activateHubView();
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
            id: 'share-notes-page',
            name: 'Share Notes',
            callback: () => {
                new ShareNoteGroupModal(this.app).open();
            },
        });

        this.addCommand({
            id: 'join-community-page',
            name: 'Join Community',
            callback: () => {
                new JoinCommunityModal(this.app).open();
            },
        });

        this.addCommand({
            id: 'create-community-page',
            name: 'Create Community',
            callback: () => {
                new CreateCommunityModal(this.app).open();
            },
        });

        this.addCommand({
            id: 'register-page',
            name: 'Register',
            callback: () => {
                new RegisterModal(this.app).open();
            },
        });

        this.addCommand({
            /*
            fetch('http://127.0.0.1:8000/auth/jwt/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `username=${this.email}&password=${this.password}`})
                .then(res => res.json())
                .then(data => {console.log(data)
            */
            id: 'log-out',
            name: 'Logout',
            callback: () => {
                fetch('http://127.0.0.1:8000/auth/jwt/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json;charset=utf-8',
                        'Authorization': `Bearer ${this.accToken}`
                    }})
                    .then((res) => {
                        if(res.status == 401) {
                            new Notice("User not verified");
                        } else if(res.status == 204) {
                            new Notice("Successfully Logged out");
                            this.setEmail("Not logged in");
                            this.setLoggedIn(false);
                            this.loginStatusEl.setText(`Currently Logged in as: ${this.email}`);
                        }
                        return res.json();
                    });
            }
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

    async activateHubView() {
        const { workspace } = this.app;

        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_HUB);
        existingLeaves.push(...workspace.getLeavesOfType(VIEW_TYPE_CONTENT));

        let leaf;

        if(existingLeaves.length > 0) {
            leaf = existingLeaves[0];
        } else {
            leaf = workspace.getLeaf("tab");
        }

        if (leaf) {
            // Replace the view in the active leaf with the Hub view
            await leaf.setViewState({ type: VIEW_TYPE_HUB, active: true });
        } else {
            // Fallback: Create a new leaf in case there's no active one
            const newLeaf = workspace.getLeaf(true);
            await newLeaf.setViewState({ type: VIEW_TYPE_HUB, active: true });
        }
    }

    async activateContentView() {
        const { workspace } = this.app;

        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_HUB);
        existingLeaves.push(...workspace.getLeavesOfType(VIEW_TYPE_CONTENT));

        let leaf;

        if(existingLeaves.length > 0) {
            leaf = existingLeaves[0];
        } else {
            leaf = workspace.getLeaf("tab");
        }

        if (leaf) {
            // Replace the view in the active leaf with the Content view
            await leaf.setViewState({ type: VIEW_TYPE_CONTENT, active: true });
        } else {
            // Fallback: Create a new leaf in case there's no active one
            const newLeaf = workspace.getLeaf(true);
            await newLeaf.setViewState({ type: VIEW_TYPE_CONTENT, active: true });
        }
    }

    setLoggedIn(loggedIn: boolean) {
        this.isLoggedIn = loggedIn;
        if (loggedIn) {
            this.activateContentView();
        } else {
            this.activateHubView();
        }
    }
}

class Hub extends ItemView {
    static instance: Hub

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    static getInstance(): Hub {
        return Hub.instance;
    }

    getViewType() {
        return VIEW_TYPE_HUB;
    }

    getDisplayText() {
        return 'Obsidian Communities Hub';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('h1', { text: 'Obsidian Communities Hub' });
        const loginBtn = container.createEl('button', { text: 'Login', cls: 'loginBtn' });
        loginBtn.setAttribute("id", "loginBtn");
        loginBtn.classList.add("loginBtn");
        loginBtn.addEventListener("click", () => {
            console.log("Button clicked!");
            new LoginModal(Communities.getInstance().app).open();
            if(Communities.getInstance().isLoggedIn == true) { this.onClose(); }
        });
        const registerBtn = container.createEl('button', { text: 'Register', cls: 'registerBtn' });
        registerBtn.setAttribute("id", "registerBtn");
        registerBtn.classList.add("registerBtn");
        registerBtn.addEventListener("click", () => {
            console.log("Button clicked!");
            new RegisterModal(Communities.getInstance().app).open();
            if(Communities.getInstance().isLoggedIn == true) { this.onClose(); }
        });
    }

    async onClose() {

    }
}

class ContentView extends ItemView {
    listOfCommunities:Array<{
            id: string,
            name: string
    }> = [];

    userId: string;

    static instance: ContentView

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    static getInstance(): ContentView {
        return ContentView.instance;
    }

    getViewType() {
        return VIEW_TYPE_CONTENT;
    }

    getDisplayText() {
        return 'Obsidian Communities Hub';
    }

    refreshView() {
        // Re-fetch data and update view after actions such as button clicks
        console.log("View Refreshed");
        this.fetchAndRenderCommunities();
    }

    async fetchAndRenderCommunities() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty(); // Clear existing content

        container.createEl('h1', { text: 'Obsidian Communities Hub' });

        // Create buttons (already defined, can be added here or elsewhere)
        this.createButtons(container);

        // List of Current Communities
        container.createEl('h2', { text: 'Your Communities' });
        const listContainer = container.createEl('ul');

        // Fetch user ID and community data
        try {
            const userResponse = await fetch(`http://127.0.0.1:8000/users/me`, {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
                },
            });
            const userData = await userResponse.json();
            this.userId = userData["id"];

            const communitiesResponse = await fetch(`http://127.0.0.1:8000/communities/user/${this.userId}`, {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
                },
            });
            const communitiesData = await communitiesResponse.json();
            this.listOfCommunities = communitiesData;

            // Render the communities in the list
            this.listOfCommunities.forEach(community => {
                const listItem = listContainer.createEl('li');
                listItem.createEl('button', { text: community.name }).addEventListener("click", () => {
                    new DownloadNoteGroupModal(Communities.getInstance().app, community.id).open();
                });
            });
        } catch (error) {
            new Notice('Error fetching communities data.');
            console.error(error);
        }
    }

    createButtons(container: HTMLElement) {
        // Create Community Button
        const createCommBtn = container.createEl('button', { text: 'Create Community', cls: 'loginBtn' });
        createCommBtn.setAttribute("id", "createCommBtn");
        createCommBtn.classList.add("createCommBtn");
        createCommBtn.addEventListener("click", () => {
            console.log("Button clicked!");
            new CreateCommunityModal(Communities.getInstance().app).open();
            this.refreshView(); // Refresh view after action
        });

        // Join Community Button
        const joinCommBtn = container.createEl('button', { text: 'Join Community', cls: 'loginBtn' });
        joinCommBtn.setAttribute("id", "joinCommBtn");
        joinCommBtn.classList.add("joinCommBtn");
        joinCommBtn.addEventListener("click", () => {
            console.log("Button clicked!");
            new JoinCommunityModal(Communities.getInstance().app).open();
            this.refreshView(); // Refresh view after action
        });

        // Logout Button
        const logoutBtn = container.createEl('button', { text: 'Logout', cls: 'logoutBtn' });
        logoutBtn.setAttribute("id", "logoutBtn");
        logoutBtn.classList.add("logoutBtn");
        logoutBtn.addEventListener("click", () => {
            console.log("Button clicked!");
            fetch('http://127.0.0.1:8000/auth/jwt/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json;charset=utf-8',
                        'Authorization': `Bearer ${Communities.getInstance().accToken}`
                    }}).then((res) => {
                        if(res.status === 204) {
                            new Notice("Successfully Logged out");
                            Communities.getInstance().setEmail("Not logged in");
                            Communities.getInstance().setLoggedIn(false);
                            this.refreshView(); // Refresh view after logout
                        }
                    });
        });

        const refreshBtn = container.createEl('button', { text: 'Refresh', cls: 'loginBtn' });
        refreshBtn.setAttribute("id", "refreshBtn");
        refreshBtn.classList.add("refreshBtn");
        refreshBtn.addEventListener("click", () => {
            console.log("Button clicked!");
            this.refreshView(); // Refresh view after action
        });
    }

    async onOpen() {
        this.fetchAndRenderCommunities(); // Initial render when view is opened
    }

    /*

    refreshView() {
        this.onOpen();
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('h1', { text: 'Obsidian Communities Hub' });

        // Create Community Button
        const createCommBtn = container.createEl('button', { text: 'Create Community', cls: 'loginBtn' });
        createCommBtn.setAttribute("id", "createCommBtn");
        createCommBtn.classList.add("createCommBtn");
        createCommBtn.addEventListener("click", () => {
            console.log("Button clicked!");
            new CreateCommunityModal(Communities.getInstance().app).open();
            this.refreshView();
        });

        // Join Community Button
        const joinCommBtn = container.createEl('button', { text: 'join Community', cls: 'loginBtn' });
        joinCommBtn.setAttribute("id", "joinCommBtn");
        joinCommBtn.classList.add("joinCommBtn");
        joinCommBtn.addEventListener("click", () => {
            console.log("Button clicked!");
            new JoinCommunityModal(Communities.getInstance().app).open();
            this.refreshView();
        });

        // List of Current Communities
        container.createEl('h2', { text: 'List of Communities' });

        const listContainer = container.createEl('ul');

        fetch(`http://127.0.0.1:8000/users/me`, {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
                },
            })
            .then(res => res.json())
            .then(data => {console.log(data)

            this.userId = data["id"];

            fetch(`http://127.0.0.1:8000/communities/user/${this.userId}`, {
                    method: "GET",
                    headers: {
                        'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
                    },
                })
                .then(res => res.json())
                .then(data => {console.log(data)

                this.listOfCommunities = data;

                for(const community of this.listOfCommunities) {
                    const listItem = listContainer.createEl('li');
                    listItem.createEl('strong', { text: community.name });
                }
            });
        });

        // Logout Button
        const logoutBtn = container.createEl('button', { text: 'Logout', cls: 'logoutBtn' });
        logoutBtn.setAttribute("id", "logoutBtn");
        logoutBtn.classList.add("logoutBtn");
        logoutBtn.addEventListener("click", () => {
            console.log("Button clicked!");
            fetch('http://127.0.0.1:8000/auth/jwt/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json;charset=utf-8',
                        'Authorization': `Bearer ${Communities.getInstance().accToken}`
                    }})
                    .then((res) => {
                        if(res.status == 401) {
                            new Notice("User not verified");
                        } else if(res.status == 204) {
                            new Notice("Successfully Logged out");
                            Communities.getInstance().setEmail("Not logged in");
                            Communities.getInstance().loginStatusEl.setText(`Currently Logged in as: ${Communities.getInstance().email}`);
                            Communities.getInstance().setLoggedIn(false);
                            this.onClose();
                        }
                        return res.json();
                    });
        });
    }
    */
    async onClose() {

    }
}

class ShareNoteGroupModal extends Modal {
    userId: string;
    communityId: string;
    noteGroupName: string;
    listOfCommunities:Array<{
        id: string,
        name: string
    }> = [];
    fieldsEl: HTMLElement;

    constructor(app: App) {
        super(app);
        this.setTitle('Share Note Group:');
        if (user.id === "") {
            this.setContent("Please login to share notes");
            return;
        }

        fetch(`http://127.0.0.1:8000/users/me`, {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
                },
            })
            .then(res => res.json())
            .then(data => {
                console.log(data)
                this.userId = data["id"];

                fetch(`http://127.0.0.1:8000/communities/user/${this.userId}`, {
                    method: "GET",
                    headers: {
                        'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
                    },
                })
                .then(res => res.json())
                .then(data => {console.log(data)

                    this.listOfCommunities = data;
                    this.communityId = data[0].id;

                    this.fieldsEl = this.contentEl.createEl('div', { cls: 'fields' });

                    new Setting(this.fieldsEl)
                        .setName('Select Community:')
                        .addDropdown((dropdown) => {
                            for(const community of this.listOfCommunities) {
                                dropdown.addOption(community.id, community.name);
                            }
                            dropdown.onChange((value) => this.communityId = value)
                        })

                    new Setting(this.fieldsEl)
                        .setName('Name of Note Group:')
                        .addText((text) => {
                            text.onChange((value) => {
                                this.noteGroupName = value;
                            })
                        })

                    new Setting(this.contentEl)
                        .addButton((btn) =>
                            btn
                                .setButtonText('Submit')
                                .setCta()
                                .onClick(() => {
                                    this.onSubmit();
                                })
                        );
                    });
        });
    }

    async onSubmit() {
        let formData = new FormData();
        const view = Communities.getInstance().app.workspace.getLeavesOfType("file-explorer")[0].view as View & {fileItems: any[]};
        const vault = Communities.getInstance().app.vault;

        const listOfFiles = [];

        for (const [noteName, fileItem] of Object.entries(view.fileItems)) {
            if(fileItem.el.children[0].classList.contains("is-selected") || fileItem.el.children[0].classList.contains("is-active")) {
                listOfFiles.push(vault.getFileByPath(fileItem.file.path));
            }
        }

        if(listOfFiles.length == 0) {
            new Notice("No File Selected");
            return;
        }
        for(const fileItem of listOfFiles) {
            formData.append('files', new File([await vault.readBinary(fileItem)], fileItem.name));
        }

        const headers = {
            'Accept': '*/*',
            'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
        };

        console.log("submitted successfully");
        fetch(`http://127.0.0.1:8000/community/${this.communityId}/${this.noteGroupName}/shared-notes`, {
            method: 'POST',
            headers,
            body: formData,
        });
        this.close();
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

class DownloadNoteGroupModal extends Modal {
    userId: string;
    communityId: string;
    //noteGroupName: string;
    noteGroupId: string;
    flashCardSetId: string;
    listOfGroups:Array<{
        id: string,
        name: string
    }> = [];
    listOfFlashcardSets:Array<{
        FlashCardSet: {
            id: string,
            name: string
        },
    }> = [];
    fieldsEl: HTMLElement;

    constructor(app: App, commId: string) {
        super(app);
        this.setTitle('Download Contents:');
        this.communityId = commId;
        if (user.id === "") {
            this.setContent("Please login to download shared notes");
            return;
        }

        fetch(`http://127.0.0.1:8000/community/${this.communityId}/shared-notes`, {
            method: "GET",
            headers: {
                'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
            },
        })
        .then(res => res.json())
        .then(data => {console.log(data)

            this.listOfGroups = data;
            //this.noteGroupName = data[0].name;
            if(data.length == 0) {
                this.contentEl.createEl("span", { text: "No note groups found" });
            } else {
                this.noteGroupId = data[0].id;

                this.fieldsEl = this.contentEl.createEl('div', { cls: 'fields' });

                new Setting(this.fieldsEl)
                    .setName('Select Note Group:')
                    .addDropdown((dropdown) => {
                        for(const group of this.listOfGroups) {
                            dropdown.addOption(group.id, group.name);
                        }
                        dropdown.onChange((value) => this.noteGroupId = value)
                    })

                new Setting(this.contentEl)
                    .addButton((btn) =>
                        btn
                            .setButtonText('Download')
                            .setCta()
                            .onClick(() => {
                                this.onNoteGroupSubmit();
                            })
                    );
            }
        });

        fetch(`http://127.0.0.1:8000/communities/${this.communityId}/flashcard-sets`, {
            method: "GET",
            headers: {
                'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
            },
        })
        .then(res => res.json())
        .then(data => {console.log(data)

            this.listOfFlashcardSets = data;
            //this.noteGroupName = data[0].name;
            if(data.length == 0) {
                this.contentEl.createEl("span", { text: "No Flash Card Sets found" });
            } else {
                this.flashCardSetId = data[0]["FlashCardSet"].id;

                this.fieldsEl = this.contentEl.createEl('div', { cls: 'fields' });

                new Setting(this.fieldsEl)
                    .setName('Select Flash Card Set:')
                    .addDropdown((dropdown) => {
                        for(const set of this.listOfFlashcardSets) {
                            dropdown.addOption(set["FlashCardSet"].id, set["FlashCardSet"].name);
                        }
                        dropdown.onChange((value) => this.flashCardSetId = value)
                    })

                new Setting(this.contentEl)
                    .addButton((btn) =>
                        btn
                            .setButtonText('Download')
                            .setCta()
                            .onClick(() => {
                                this.onFlashCardSetSubmit();
                            })
                    );
            }
        });
    }

    async onFlashCardSetSubmit() {
        fetch(`http://127.0.0.1:8000/flashcards/flashcard-sets/${this.flashCardSetId}`, {
            method: "GET",
            headers: {
                'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
            },
        })
        .then(res => res.json())
        .then(data => {
            const serializedFlashcard = {
                name: data["FlashCardSet"].name,
                id: Date.now(),
                flashcards: data["FlashCards"].map((flashcard:any) => [flashcard["question"], flashcard["answer"]])
            }
            Communities.getInstance().settings.flashcardSets.push(serializedFlashcard);
            new Notice("Flashcard set created!");
            Communities.getInstance().saveSettings();
        })
    }

    async onNoteGroupSubmit() {
        const vault = Communities.getInstance().app.vault;

        fetch(`http://127.0.0.1:8000/community/${this.communityId}/shared-notes/${this.noteGroupId}`, {
            method: "GET",
            headers: {
                'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
            },
        })
        .then(async res => {

        const arrayBuffer = res.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        try {
            vault.createFolder(vault.getRoot().path+"/Shared_Notes");
        } catch { }

        for(const [fileName, file] of Object.entries(zip.files as {any:any})) {
            vault.createBinary(vault.getRoot().path+"/Shared_Notes/"+fileName, await file.async("arraybuffer"));
        }

        });
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

class JoinCommunityModal extends Modal {
    id: string;
    fieldsEl: HTMLElement;

    constructor(app: App) {
        super(app);
        this.setTitle('Create Community:');

        this.fieldsEl = this.contentEl.createEl('div', { cls: 'fields' });

        new Setting(this.fieldsEl)
            .setName('Enter Community ID:')
            .addText((text) =>
                text.onChange((value) => {
                    this.id = value;
                }
            )
        );

        new Setting(this.contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText('Submit')
                    .setCta()
                    .onClick(() => {
                        this.onSubmit();
                    })
            );
    }

    onSubmit() {
        console.log("submitted successfully");
        fetch(`http://127.0.0.1:8000/communities/join/${this.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
            },
        });
        this.close();
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
                Communities.getInstance().setAccToken(accessToken);
                Communities.getInstance().setEmail(this.email);
                Communities.getInstance().setLoggedIn(true);
                Communities.getInstance().loginStatusEl.setText(`Currently Logged in as: ${this.email}`);
                fetch(`http://127.0.0.1:8000/users/me`, {
                    method: "GET",
                    headers: {
                        'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
                    },
                }).then(res => res.json()).then(data => user.id = data["id"]);
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
                    Communities.getInstance().setLoggedIn(true);
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

class CreateCommunityModal extends Modal {
    name: string;
    fieldsEl: HTMLElement;

    constructor(app: App) {
        super(app);
        this.setTitle('Create Community:');

        this.fieldsEl = this.containerEl.querySelector(".modal").createEl('div', { cls: 'fields' });

        new Setting(this.fieldsEl)
            .setName('Enter Community Name:')
            .addText((text) =>
                text.onChange((value) => {
                    this.name = value;
                }
            )
        );

        new Setting(this.containerEl.querySelector(".modal"))
            .addButton((btn) =>
                btn
                    .setButtonText('Submit')
                    .setCta()
                    .onClick(() => {
                        this.onSubmit();
                    })
            );
    }

     onSubmit() {
        console.log("submitted successfully");
         fetch(`http://127.0.0.1:8000/communities/create/${this.name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                'Authorization': `Bearer ${Communities.getInstance().getAccToken()}`
            },
        });
        this.close();
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