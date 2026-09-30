// Importing this module registers every catalog entry. Engines, the bench and tests import it.
import './wiring';
import './io';
import './logic';
import './analog';
import './sequential';
import './blocks';
export { defineComponents, getDef, allDefs, withDefaults, pinsOf, boundsOf, transformPoint } from './registry';
