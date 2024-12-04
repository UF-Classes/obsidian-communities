import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf } from 'obsidian';
import "ts/main.ts";

class ShareNoteGroupModal extends Modal {
    id: string;
    fieldsEl: HTMLElement;

    constructor(app: App) {
        super(app);
        this.setTitle('Share Note Group:');

        this.fieldsEl = this.containerEl.querySelector(".modal").createEl('div', { cls: 'fields' });

        new Setting(this.fieldsEl)
            .setName('Enter Community ID:')
            .addText((text) =>
                text.onChange((value) => {
                    this.id = value;
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
        fetch(`http://127.0.0.1:8000/community/${this.id}/shared-notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data',
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

class EditNoteGroupModal extends Modal {
    id: string;
    fieldsEl: HTMLElement;

    constructor(app: App) {
        super(app);
        this.setTitle('Share Note Group:');

        this.fieldsEl = this.containerEl.querySelector(".modal").createEl('div', { cls: 'fields' });

        new Setting(this.fieldsEl)
            .setName('Enter Community ID:')
            .addText((text) =>
                text.onChange((value) => {
                    this.id = value;
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
        fetch(`http://127.0.0.1:8000/community/${this.id}/shared-notes/${file-group-id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'multipart/form-data',
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

class JoinCommunityModal extends Modal {
    id: string;
    fieldsEl: HTMLElement;

    constructor(app: App) {
        super(app);
        this.setTitle('Create Community:');

        this.fieldsEl = this.containerEl.querySelector(".modal").createEl('div', { cls: 'fields' });

        new Setting(this.fieldsEl)
            .setName('Enter Community ID:')
            .addText((text) =>
                text.onChange((value) => {
                    this.id = value;
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