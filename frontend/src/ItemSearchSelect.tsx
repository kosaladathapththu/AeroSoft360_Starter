import { Children, isValidElement, ReactNode, SelectHTMLAttributes, useState } from "react";
function label(node:ReactNode):string {
  if(typeof node==="string"||typeof node==="number")return String(node);
  if(isValidElement<{children?:ReactNode}>(node))return label(node.props.children);
  return Children.toArray(node).map(label).join(" ");
}
export default function ItemSearchSelect({children, searchLabel = "Search article or item", searchPlaceholder = "Search article / item name or code", ...props}:SelectHTMLAttributes<HTMLSelectElement> & { searchLabel?: string; searchPlaceholder?: string }) {
  const [query,setQuery]=useState("");
  const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const options=Children.toArray(children).filter(child=>{
    if(!isValidElement<{value?:string|number}>(child))return true;
    if(!child.props.value||String(child.props.value)===String(props.value))return true;
    const text=label(child).toLowerCase();return terms.every(term=>text.includes(term));
  });
  return <span className="item-search-select"><input type="search" aria-label={searchLabel} placeholder={searchPlaceholder} value={query} onChange={e=>setQuery(e.target.value)}/><select {...props}>{options}</select></span>;
}
