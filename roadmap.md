# QuestionAR — requested changes
- [x] Restore original local graphics and icon-generation source from questionar-fixed.zip; remove CDN asset pointers and verify local PWA references without changing app logic (original bytes verified, local resources return 200, logos render, 28 tests pass).
- [ ] Apply the requested fuchsia/teal day and night tokens, primary/focus glow and coherent controls.
- [ ] Verify day/night switching, palette fidelity, readability, tag appearance and existing tests.
- [x] Import the uploaded app while preserving its zero-server behavior and existing appearance.
- [x] Replace negative-tag X icons and labels with Ban/divieto; use destructive red without the white separator.
- [x] Expand the tutorial with interactive tags, custom questions, rich bio, three-way/category comparisons, local privacy, PNG steganography and emoji collections.
- [x] Run relevant tests and verify tag editing and the tutorial in the browser (26 tests passed; saved negative tags restored after reload; desktop/mobile tutorial verified without overflow or runtime errors).
- [x] Add the local diagnostic mode (5 taps on the Info title): automatic checks, manual checklist, explicit JSON export, privacy-safe buffer; 43 tests pass, flow verified in Chromium dev preview.
- [ ] Manual verification on real devices/installed PWA, offline and relay scenarios (developer to run via the checklist).
