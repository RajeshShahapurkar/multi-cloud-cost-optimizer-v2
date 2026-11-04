import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"Multi-Cloud Cost Optimizer",description:"Unified multi-cloud billing and resource optimization"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
