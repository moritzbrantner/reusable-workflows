import { type ReactElement, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

export * from "../node_modules/@moritzbrantner/ui/dist/index.js";
export { Badge } from "@moritzbrantner/ui/components/stable/badge";
export { Button } from "@moritzbrantner/ui/components/stable/button";
export {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@moritzbrantner/ui/components/stable/card";
export { Checkbox } from "@moritzbrantner/ui/components/stable/checkbox";
export { Input } from "@moritzbrantner/ui/components/stable/input";
export {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@moritzbrantner/ui/components/stable/item";
export {
  NativeSelect,
  NativeSelectOption,
} from "@moritzbrantner/ui/components/stable/native-select";
export { Progress } from "@moritzbrantner/ui/components/stable/progress";
export { ToggleGroup, ToggleGroupItem } from "@moritzbrantner/ui/components/stable/toggle-group";

export type ChartConfig = Record<
  string,
  {
    color?: string;
    label?: ReactNode;
  }
>;

export function ChartContainer({
  children,
  className,
}: {
  children: ReactElement;
  className?: string;
  config?: ChartConfig;
}) {
  return (
    <div className={className} data-slot="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
