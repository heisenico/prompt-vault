// DOM side of keyed list rendering: applies the plan from keyed-list.js so
// unchanged nodes (and the focus, drafts and scroll inside them) are never
// recreated.

import { planListUpdate } from "./keyed-list.js";

/** Signature each <li> was rendered with. Kept off the DOM: signatures embed whole prompts. */
const signatures = new WeakMap();

/**
 * @param {HTMLUListElement} list
 * @param {Array<{ key: string, signature: string, render: () => { markup: string } }>} items
 *   `render` returns the markup inside each <li>; this function owns the <li> itself
 *   and calls `render` only for items it creates or replaces.
 */
export function renderKeyedList(list, items) {
  const nodes = new Map();
  const previous = new Map();
  for (const node of list.children) {
    nodes.set(node.dataset.key, node);
    previous.set(node.dataset.key, signatures.get(node));
  }

  const { removals, steps } = planListUpdate(
    previous,
    items.map(({ key, signature }) => [key, signature]),
  );
  for (const key of removals) nodes.get(key).remove();

  const itemByKey = new Map(items.map((item) => [item.key, item]));
  const canMove = typeof list.moveBefore === "function";
  let placed = null;

  for (const { key, action } of steps) {
    let node = nodes.get(key);
    if (action !== "keep") {
      const fresh = createItem(itemByKey.get(key));
      if (node) node.replaceWith(fresh);
      node = fresh;
    }
    const expectedPosition = placed ? placed.nextSibling : list.firstChild;
    if (node !== expectedPosition) {
      if (node.parentNode === list && canMove) list.moveBefore(node, expectedPosition);
      else list.insertBefore(node, expectedPosition);
    }
    placed = node;
  }
}

function createItem({ key, signature, render }) {
  const template = document.createElement("template");
  template.innerHTML = render().markup;
  const item = document.createElement("li");
  item.dataset.key = key;
  signatures.set(item, signature);
  item.append(template.content);
  return item;
}
