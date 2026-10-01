/** Keep authored chapter links inside the course, including when hosted below a project path. */
export function remarkCourseLinks({ base }) {
  const resolve = (url) => typeof url === 'string' && url.startsWith('/ch/') ? `${base}${url}` : url;
  return (tree) => {
    function walk(node) {
      if (node.type === 'link' || node.type === 'linkReference') node.url = resolve(node.url);
      if (node.type === 'definition') node.url = resolve(node.url);
      // MDX also contains explicit <a href="/ch/…"> elements.
      for (const attr of node.attributes ?? []) {
        if (attr.type === 'mdxJsxAttribute' && attr.name === 'href') attr.value = resolve(attr.value);
      }
      for (const child of node.children ?? []) walk(child);
    }
    walk(tree);
  };
}
