// Single-player build: the same client driven by the in-process simulation.
import { Game } from './game.js';
import { LocalStore } from '../server/game/base.js';

const game = new Game(new LocalStore());
game.boot();
window.__hobile = game;
