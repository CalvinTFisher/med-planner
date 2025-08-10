// super-permissive shims for local JS UI components (relative imports)
declare module "./components/ui/button"    { export const Button: any; }
declare module "./components/ui/card"      {
  export const Card: any;
  export const CardHeader: any;
  export const CardTitle: any;
  export const CardDescription: any;
  export const CardContent: any;
}
declare module "./components/ui/input"     { export const Input: any; }
declare module "./components/ui/label"     { export const Label: any; }
declare module "./components/ui/select"    {
  export const Select: any;
  export const SelectTrigger: any;
  export const SelectValue: any;
  export const SelectContent: any;
  export const SelectItem: any;
}
declare module "./components/ui/badge"     { export const Badge: any; }
declare module "./components/ui/tabs"      {
  export const Tabs: any;
  export const TabsList: any;
  export const TabsTrigger: any;
  export const TabsContent: any;
}
declare module "./components/ui/switch"    { export const Switch: any; }
declare module "./components/ui/textarea"  { export const Textarea: any; }
declare module "./components/ui/separator" { export const Separator: any; }
