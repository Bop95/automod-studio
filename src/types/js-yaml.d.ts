declare module "js-yaml" {
  const yaml: {
    loadAll(source: string, iterator?: (document: unknown) => void): unknown[];
    dump(
      object: unknown,
      options?: {
        indent?: number;
        lineWidth?: number;
        quotingType?: '"' | "'";
        forceQuotes?: boolean;
        noRefs?: boolean;
      }
    ): string;
  };

  export default yaml;
}
