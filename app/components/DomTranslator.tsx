'use client';

import { useEffect } from 'react';
import { useLanguage } from '../lib/i18n';
import { TRANSLATED_ATTRIBUTES, shouldSkip, translateExact } from '../lib/domTranslation';

/**
 * Translates what is on the page that was not written through `the t function`, and keeps doing so as the page changes. Swedish only;
 * switching back to English puts the original texts back.
 */
export default function DomTranslator() {
  const language = useLanguage();

  useEffect(() => {
    if (language !== 'sv') return undefined;
    const originalText = new WeakMap<Node, string>();
    const originalAttrs = new WeakMap<Element, Map<string, string>>();

    const translateTextNode = (node: Text) => {
      if (shouldSkip(node.parentElement)) return;
      const current = node.nodeValue ?? '';
      const next = translateExact('sv', current);
      if (next !== current) {
        if (!originalText.has(node)) originalText.set(node, current);
        node.nodeValue = next;
      }
    };
    const translateAttributes = (element: Element) => {
      if (shouldSkip(element)) return;
      for (const name of TRANSLATED_ATTRIBUTES) {
        const current = element.getAttribute(name);
        if (current === null) continue;
        const next = translateExact('sv', current);
        if (next !== current) {
          let map = originalAttrs.get(element);
          if (!map) originalAttrs.set(element, (map = new Map()));
          if (!map.has(name)) map.set(name, current);
          element.setAttribute(name, next);
        }
      }
    };
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      translateAttributes(root as Element);
      const tree = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node: Node | null = tree.nextNode();
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
        else translateAttributes(node as Element);
        node = tree.nextNode();
      }
    };

    walk(document.body);
    let frame = 0;
    const queue = new Set<Node>();
    const flush = () => {
      frame = 0;
      for (const node of queue) if (node.isConnected) walk(node);
      queue.clear();
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach((node) => queue.add(node));
        else if (record.type === 'characterData') queue.add(record.target);
        else if (record.type === 'attributes') queue.add(record.target);
      }
      if (!frame) frame = window.requestAnimationFrame(flush);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...TRANSLATED_ATTRIBUTES] });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      // Back to English: put the original text back wherever we changed it.
      const restore = (root: Node) => {
        const tree = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        let node: Node | null = tree.currentNode;
        while (node) {
          if (node.nodeType === Node.TEXT_NODE) {
            const original = originalText.get(node);
            if (original !== undefined) node.nodeValue = original;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const map = originalAttrs.get(node as Element);
            if (map) for (const [name, value] of map) (node as Element).setAttribute(name, value);
          }
          node = tree.nextNode();
        }
      };
      restore(document.body);
    };
  }, [language]);

  return null;
}
