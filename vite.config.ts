import { defineConfig } from 'vite';

// Relative base: the same build works at a domain root and under a sub-path,
// which is where GitHub Pages serves a project site (/typing_trainer/).
export default defineConfig({ base: './' });
