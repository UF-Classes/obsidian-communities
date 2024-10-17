## Contributing
### Setup
- Clone this repo by running `git clone https://github.com/UF-Classes/obsidian-communities.git` in terminal.
- `pip install -r requirements.txt` to install back-end dependencies.
- `python -m uvicorn api.main:app --reload` to start the back-end server.
- `npm i` to install front-end dependencies.
- `npm run dev` to start compilation in watch mode.

### Testing the plugin in Obsidian (Windows)
- Make sure there's a dist folder in the project root directory; it should be generated after running `npm run dev` for the first time.
- In your Obsidian vault folder, create a "plugins" folder in your ".obsidian" folder if it doesn't already exist.
- Run a terminal with administrator privileges.
- `cd` to the project root directory.
- Run the following command but replace the path in the last argument with the path corresponding with your own Obsidian vault:
```bash
New-Item -ItemType SymbolicLink -Target "$(pwd)/dist" -Path "C:\PATH_TO_MY_VAULT\.obsidian\plugins\obsidian-communities"
```
This will create a synchronized copy of the dist folder, so every time the plugin compiles, it will update in the plugins folder, as well.

In Obsidian settings, be sure to enable the plugin.

For hot reloading (automatically reload the plugin in Obsidian when the code changes), install the [Obsidian hot-reload plugin
](https://github.com/pjeby/hot-reload) and enable it. Add a file named `.hotreload` to the `dist` folder.
### API Documentation

See https://docs.obsidian.md/Home
