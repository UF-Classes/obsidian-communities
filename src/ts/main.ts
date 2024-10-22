import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { LoginModal } from './modal';
import "../styles/styles.scss";

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
             	new LoginModal(this.app, (result) => {
                    new Notice(`Hello, ${result}!`);
                }).open();
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

        this.addSettingTab(new SampleSettingTab(this.app, this));
    }

    onunload() {
        console.log('unloading plugin');
    }
}

class LoginModal extends Modal {
    constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
	this.setTitle('Login:');

	let username = '';

	let email = '';
    new Setting(this.contentEl)
      .setName('Email Address:')
      .addText((text) =>
        text.onChange((value) => {
          email = value;
          if(email.indexOf('@') != -1) { username = email.substring(0, email.indexOf('@')); }
          else {
            username = email;
          }
        }));

    let password = '';
    new Setting(this.contentEl)
      .setName('Password:')
      .addText((text) =>
        text.onChange((value) => {
          password = value;
        }));

    new Setting(this.contentEl)
      .addButton((btn) =>
        btn
          .setButtonText('Login')
          .setCta()
          .onClick(() => {
            this.close();
            onSubmit(username);
          }));
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
