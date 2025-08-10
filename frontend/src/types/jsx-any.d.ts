// Allow arbitrary props on JSX elements from JS components
declare namespace JSX {
  interface IntrinsicAttributes {
    [prop: string]: any;
  }
}
