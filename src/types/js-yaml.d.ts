declare module "js-yaml" {
  const yaml: {
    loadAll(source: string, iterator?: (document: unknown) => void): unknown[];
  };

  export default yaml;
}
