These files are ready to add to the root of your GitHub repository:

- CITATION.cff
- .zenodo.json
- LICENSE
- RELEASE_NOTES_v1.0.0.md

Recommended next step:
1. Commit these files to `main`
2. Create GitHub release `v1.0.0`
3. Enable the repository in Zenodo
4. After Zenodo mints the DOI, update:
   - CITATION.cff (`doi:` field)
   - README DOI badge
   - release notes or docs as desired

Note:
- GitHub will use `CITATION.cff` for the "Cite this repository" prompt.
- Zenodo will prefer `.zenodo.json` over `CITATION.cff` for GitHub-release archiving metadata.
