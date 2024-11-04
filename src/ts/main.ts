import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import "../styles/styles.scss";

let accessToken: string = "";

export default class Communities extends Plugin {

    onInit() {

    }

    onload() {
        console.log('loading plugin');

        this.addRibbonIcon('dice', 'Obsidian-Communities Test', () => {
            new Notice('In development!');
        });

        this.addStatusBarItem().setText('Obsidian Communities');

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

        this.addSettingTab(new SampleSettingTab(this.app, this));
    }

    onunload() {
        console.log('unloading plugin');
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
