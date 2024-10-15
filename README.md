## Contributing
### Setup
- Clone this repo.
- `pip install -r requirements.txt` to install back-end dependencies.
- `uvicorn api.main:app --reload` to start the back-end server.
- `npm i` to install front-end dependencies.
- `npm run dev` to start compilation in watch mode.

### Testing the plugin in Obsidian
- Run a terminal with administrator privileges.
- `cd` to the project root directory.
- Run the following command but replace the path in the last argument with the path corresponding with your own Obsidian vault:
```bash
New-Item -ItemType SymbolicLink -Target "$(pwd)/dist" -Path "C:\PATH_TO_MY_VAULT\.obsidian\plugins\obsidian-communities"
```
This will create a synchronized copy to the dist folder, so every time the plugin compiles, it will update in the plugins folder, as well.

In Obsidian settings, be sure to enable the plugin.

### API Documentation

See https://docs.obsidian.md/Home
