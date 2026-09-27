// Page script for Appendix A1: unit conversions and the magnitude scale as draggable numbers.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const PC = 3.0857e16; // m
const LY = 9.4607e15; // m

compute('dly', ['dpc'], ({ dpc }) => `${fmt(dpc * PC / LY, 3)} light-years`);
compute('dm', ['dpc'], ({ dpc }) => `${fmt(dpc * PC, 3)} m`);
compute('dau', ['dpc'], ({ dpc }) => `${fmt(dpc * 206265, 3)} AU`);
compute('dage', ['dpc'], ({ dpc }) => {
  const yr = dpc * PC / LY;
  return yr < 1e3 ? `${fmt(yr, 3)} years` : yr < 1e6 ? `${fmt(yr / 1e3, 3)} thousand years` : yr < 1e9 ? `${fmt(yr / 1e6, 3)} million years` : `${fmt(yr / 1e9, 3)} billion years`;
});
compute('fratio', ['dmag'], ({ dmag }) => `${fmt(10 ** (0.4 * dmag), 3)}`);
