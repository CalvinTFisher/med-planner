import * as React from "react";

declare module "./components/ui/button" {
  export const Button: React.FC<any>;
}

declare module "./components/ui/card" {
  export const Card: React.FC<any>;
  export const CardHeader: React.FC<any>;
  export const CardTitle: React.FC<any>;
  export const CardDescription: React.FC<any>;
  export const CardContent: React.FC<any>;
}

declare module "./components/ui/input" {
  export const Input: React.ForwardRefExoticComponent<
    React.InputHTMLAttributes<HTMLInputElement> &
    React.RefAttributes<HTMLInputElement>
  >;
}

declare module "./components/ui/label" {
  export const Label: React.FC<any>;
}

declare module "./components/ui/select" {
  export const Select: React.FC<any>;
  export const SelectTrigger: React.FC<any>;
  export const SelectValue: React.FC<any>;
  export const SelectContent: React.FC<any>;
  export const SelectItem: React.FC<any>;
}

declare module "./components/ui/badge" {
  export const Badge: React.FC<any>;
}

declare module "./components/ui/tabs" {
  export const Tabs: React.FC<any>;
  export const TabsList: React.FC<any>;
  export const TabsTrigger: React.FC<any>;
  export const TabsContent: React.FC<any>;
}

declare module "./components/ui/switch" {
  export const Switch: React.FC<any>;
}

declare module "./components/ui/textarea" {
  export const Textarea: React.ForwardRefExoticComponent<
    React.TextareaHTMLAttributes<HTMLTextAreaElement> &
    React.RefAttributes<HTMLTextAreaElement>
  >;
}

declare module "./components/ui/separator" {
  export const Separator: React.FC<any>;
}
