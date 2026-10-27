// DOM side of keyed list rendering: applies the plan from keyed-list.js so
// unchanged nodes (and the focus, drafts and scroll inside them) are never
// recreated.

import { planListUpdate } from "./keyed-list.js";

/**
 * @param {HTMLUListElement} list
 * @param {Array<{ key: string, signature: string, view: { markup: string } }>} items
 *   `view` is the markup inside each <li>; this function owns the <li> itself.
 */
export function renderKeyedList(list, items) {
  const nodes = new Map();
  const previous = new Map();
  for (const node of list.children) {
    nodes.set(node.dataset.key, node);
    previous.set(node.dataset.key, node.dataset.signature);
  }

  const { removals, steps } = planListUpdate(
    previous,
    items.map(({ key, signature }) => [key, signature]),
  );
  for (const key of removals) nodes.get(key).remove();

  const viewByKey = new Map(items.map((item) => [item.key, item]));
  const canMove = typeof list.moveBefore === "function";
  let placed = null;

  for (const { key, action } of steps) {
    let node = nodes.get(key);
    if (action !== "keep") {
      const fresh = createItem(viewByKey.get(key));
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

function createItem({ key, signature, view }) {
  const template = document.createElement("template");
  template.innerHTML = view.markup;
  const item = document.createElement("li");
  item.dataset.key = key;
  item.dataset.signature = signature;
  item.append(template.content);
  return item;
}
