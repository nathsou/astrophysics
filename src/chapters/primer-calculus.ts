// Page script for Appendix A4 (primer-calculus): wires <Var>/<Out>.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// Finite-difference derivative of sin at x = 1 (true value cos 1): truncation error vs round-off.
const X = 1, TRUE = Math.cos(X);
compute('fdFwd', ['fdh'], ({ fdh }) => {
  const d = (Math.sin(X + fdh) - Math.sin(X)) / fdh;
  return fmt(Math.abs(d - TRUE), 2);
});
compute('fdCen', ['fdh'], ({ fdh }) => {
  const d = (Math.sin(X + fdh) - Math.sin(X - fdh)) / (2 * fdh);
  return fmt(Math.abs(d - TRUE) || 1e-17, 2);
});
