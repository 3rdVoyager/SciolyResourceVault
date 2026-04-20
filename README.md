# Scioly Resource Vault
Student-maintained directory of Science Olympiad study resources.

### Quick start
- Open Github pages at: https://3rdvoyager.github.io/SciolyResourceVault/
- Or open `index.html` in a browser. The app reads `resources.json` (local) and provides filters and search.

### Future Updates
- Transition from local JSON file to cloud SQL database
- Style UI
- Add tabs for further resources beyond test archives

### Structure
- `index.html` — main page
- `style.css` — styles
- `app.js` — minimal JS app: loads `resources.json`, filters, and renders results
- `resources.json` — local JSON database (array of resource objects). Will likely be removed after transition to cloud hosted database.
- `CHANGELOG.md` — project changelog

### Reporting issues / takedowns
- Use the Contact / Report link in the site footer.

### Notes
- All links open in a new tab (`target="_blank"`) for safety. The site acts as a directory and does not host files.

### License
- This project is non-commercial and maintained by volunteers.
