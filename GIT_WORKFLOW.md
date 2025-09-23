# Git Workflow Quick Reference

## Repository Status
✅ **Initialized**: Git repository is ready
✅ **Initial Commit**: All files committed to `main` branch
✅ **Line Endings**: Configured for cross-platform compatibility

## Next Steps

### 1. Connect to GitHub/GitLab
```bash
# Create a new repository on GitHub/GitLab first, then:
git remote add origin https://github.com/yourusername/leo-portfolio.git
git push -u origin main
```

### 2. Useful Git Commands
```bash
# Check status
git status

# View changes
git diff

# Stage changes
git add .                    # Stage all changes
git add filename.ext         # Stage specific file

# Commit changes
git commit -m "Description"

# Push to remote
git push

# Pull latest changes
git pull

# View commit history
git log --oneline
```

### 3. Branch Workflow
```bash
# Create and switch to feature branch
git checkout -b feature/new-feature

# Switch between branches
git checkout main
git checkout feature/new-feature

# Merge feature branch
git checkout main
git merge feature/new-feature

# Delete merged branch
git branch -d feature/new-feature
```

### 4. Project-Specific Workflow

#### Adding New Projects
```bash
# 1. Edit projects.json
# 2. Generate pages and commit
npm run generate-projects
git add .
git commit -m "Add new project: ProjectName"
```

#### Updating Assets
```bash
# 1. Add new media to assets/
# 2. Optimize and commit
npm run optimize
git add .
git commit -m "Add optimized media assets"
```

#### Full Build
```bash
# Generate everything and commit
npm run build
git add .
git commit -m "Update generated content and optimized assets"
```

## Repository Structure
```
leo-portfolio/
├── .git/                   # Git repository data
├── .gitattributes         # Line ending configuration
├── .gitignore             # Ignored files/folders
├── README.md              # Project documentation
├── package.json           # Dependencies and scripts
├── index.html             # Main page
├── styles.css             # Stylesheet
├── main.js                # JavaScript functionality
├── projects.json          # Project data
├── generate-projects.js   # Page generator
├── optimize-media.js      # Media optimizer
├── assets/                # Media files
├── projects/              # Generated pages (ignored)
└── docs/                  # Documentation
    └── a11y.md           # Accessibility report
```

## Deployment Options

### GitHub Pages
1. Push to GitHub
2. Go to Settings → Pages
3. Select "GitHub Actions" as source
4. The included workflow will deploy automatically

### Netlify
1. Connect your GitHub repository
2. Build command: `npm run build`
3. Publish directory: `/` (root)
4. Environment variables: None needed

### Vercel
1. Import GitHub repository
2. Framework: Other
3. Build command: `npm run build`
4. Output directory: `./`

## Tips

- Always run `npm run build` before committing major changes
- Use descriptive commit messages
- Create feature branches for major changes
- Keep the main branch deployable
- Regularly optimize media with `npm run optimize`