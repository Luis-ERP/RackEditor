import lab1 from './labs/lab-1-first-rack.js';
import lab2 from './labs/lab-2-send-to-quoter.js';
import lab3 from './labs/lab-3-add-quote-line.js';

export const LAB_REGISTRY = {
  [lab1.id]: lab1,
  [lab2.id]: lab2,
  [lab3.id]: lab3,
};

export const LAB_LIST = [lab1, lab2, lab3];
