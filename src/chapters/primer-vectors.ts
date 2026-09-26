// Page script for Appendix A3: splitting a star's velocity into line-of-sight and sky-plane parts.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const D = Math.PI / 180;
compute('vrad', ['vs', 'vang'], ({ vs, vang }) => `${fmt(vs * Math.cos(vang * D), 3)} km/s`);
compute('vtan', ['vs', 'vang'], ({ vs, vang }) => `${fmt(Math.abs(vs * Math.sin(vang * D)), 3)} km/s`);
