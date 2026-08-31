---
title: "Panel-Level Packaging: From Wafers to Panels"
description: Explore how panel-level packaging could improve semiconductor packaging efficiency, support chiplet integration, and reshape advanced manufacturing.
date: 2026-08-25
---
# From Wafers to Panels: Why Panel-Level Packaging Could Transform Semiconductor Manufacturing

![](https://i.meee.com.tw/ilzuTq7.png)

Advanced semiconductor performance increasingly depends not only on smaller transistors, but also on how multiple dies, memory, interconnects, and passive components are assembled into one package. That shift is raising the strategic importance of advanced packaging. One technology attracting growing attention is panel-level packaging (PLP), especially fan-out panel-level packaging (FOPLP).

Despite the name, PLP does not mean replacing round silicon wafers in front-end chip fabrication with rectangular panels. Instead, it changes part of the back-end packaging flow. Rather than building redistribution layers and related structures on a circular reconstituted wafer, manufacturers process many dies on a much larger rectangular carrier. The goal is straightforward: use more surface area efficiently, process more packages per batch, and create a manufacturing platform better suited to larger, more complex multi-die systems.

## What Changes When Packaging Moves from Wafers to Panels?

Fan-out wafer-level packaging (FOWLP) has already demonstrated the value of placing known-good dies into a reconstituted carrier and building fine redistribution layers (RDLs) around them. This allows I/O connections to extend beyond the original die footprint without relying on a conventional package substrate.

Panel-level packaging takes the same basic idea to a larger, rectangular format. Fraunhofer IZM, for example, has worked with formats including 300 × 300 mm, 510 × 515 mm, and roughly 456 × 610 mm, while SEMI standards address panel handling for 510 × 515 mm and 600 × 600 mm formats. These dimensions are not merely a question of size. They affect equipment design, material behavior, automation, metrology, and process control.

|Manufacturing factor|Wafer-level fan-out|Panel-level fan-out|
|---|---|---|
|Carrier shape|Circular|Rectangular or square|
|Manufacturing ecosystem|More mature|Still developing and standardizing|
|Area utilization|Limited by round geometry|Potentially better for rectangular packages|
|Throughput opportunity|Established high-volume flows|More packages processed per carrier|
|Scaling challenge|Known fan-out issues|Warpage, die shift, uniformity, handling, and equipment compatibility become harder at larger sizes|

The economic argument begins with geometry. Semiconductor packages are usually rectangular, while wafers are round. A rectangular panel can therefore reduce unused edge area and, because panels can be substantially larger than 300 mm wafers, can place many more package units on one carrier. In principle, this spreads certain processing costs across more devices. Industry roadmaps have long identified increased processing area as one of the central economic motivations for moving fan-out packaging toward larger rectangular panels.

However, “larger” does not automatically mean “cheaper.” Cost per package depends on yield, line utilization, process time, equipment depreciation, materials, rework, and the value of any devices lost when a defect occurs. A panel process becomes economically attractive only when those factors remain under control at scale.

## Why PLP Matters More in the Chiplet Era

The case for panel processing is becoming stronger as package size grows. AI accelerators, high-performance computing devices, automotive electronics, and communications systems increasingly combine logic dies, memory, I/O dies, and other components through heterogeneous integration. Packaging is becoming a platform for system architecture rather than a final protective shell.

Larger panels could provide more room for multi-chip assemblies and high-density RDL structures while improving manufacturing efficiency. Fraunhofer IZM has specifically linked PLP momentum to chiplet integration and large-body packages. In the United States, NIST’s CHIPS for America program has also funded work exploring the commercial viability of 600 mm panel-level manufacturing for advanced fan-out and heterogeneous integration.

This matters because advanced packaging is now part of the performance equation. Shorter interconnects between dies can improve bandwidth and reduce the distance signals must travel compared with communication across a conventional printed circuit board. Panel processing does not create these benefits by itself, but it could become a manufacturing method that makes some advanced package architectures more scalable.

## The Hard Part: Manufacturing Control at Large Area

Moving from wafer to panel is not a simple equipment resize. Fan-out processes already face challenges such as die shift during molding and warpage caused by mismatched material properties and thermal cycles. At panel scale, maintaining flatness and alignment across a larger area becomes even more demanding. Research and industry roadmaps have consistently identified warpage and die shift as important manufacturing issues in fan-out packaging.

Die placement accuracy is especially important because RDL features must align with the actual post-molding die locations. Manufacturers may need adaptive design or maskless imaging approaches that compensate for measured die movement. Fraunhofer IZM, for example, has demonstrated approaches that measure die shift and adapt subsequent routing layouts to the actual die positions.

Large panels also require uniform deposition, lithography, plating, molding, curing, and inspection across the full surface. A process that is well controlled over a wafer-sized area may behave differently when transferred to a much larger substrate.

Equipment standardization is another practical issue. If every manufacturer uses a different panel size, tool suppliers must support multiple handling systems, carriers, load ports, and process chambers. SEMI’s PLP standards work reflects the industry’s effort to reduce this fragmentation by defining panel characteristics and compatible front-opening unified pods (FOUPs). SEMI 3D20 addresses physical panel characteristics, while the E181 family covers panel FOUP requirements.

These challenges explain why PLP should be viewed as an evolving manufacturing platform rather than an inevitable replacement for wafer-level packaging. FOWLP benefits from years of process learning and an established equipment base. PLP must prove that its theoretical productivity advantage survives real-world yield, reliability, and capital-cost requirements.

## FAQ

**Q1. What is panel-level packaging?**
A: Panel-level packaging is an advanced semiconductor packaging approach in which multiple dies and package structures are processed on a rectangular or square panel rather than a circular wafer-sized carrier. It is commonly associated with fan-out packaging, RDL formation, and heterogeneous integration.

**Q2. Is PLP the same as wafer-level packaging?**
A: No. They can use related fan-out concepts, but the carrier format and manufacturing infrastructure differ. Wafer-level packaging uses wafer-shaped formats, while PLP scales processing to larger panels.

**Q3. Why can panels improve manufacturing efficiency?**
A: Panels can offer greater usable surface area and a better geometric fit for rectangular packages. That can increase the number of units processed in one batch and potentially lower cost per package if yield and throughput remain high.

**Q4. What are the biggest technical challenges?**
A: Key challenges include panel warpage, die shift, fine-line RDL alignment, process uniformity, defect control, automated handling, and reliable metrology over a large area.

**Q5. Will panel-level packaging replace wafer-level packaging?**
A: Probably not across all applications. Wafer-level processes remain highly mature and efficient. PLP is more likely to complement them, especially where larger package sizes, chiplet integration, or higher panel utilization create a meaningful economic advantage.

**Q6. What applications could benefit most from PLP?**
A: Potential beneficiaries include high-performance computing, AI hardware, advanced networking, automotive electronics, and other systems that require large or heterogeneous multi-die packages. The strongest use cases will depend on package design, production volume, yield, and cost targets.

## Conclusion

Panel-level packaging represents a shift in how the semiconductor industry may scale advanced packaging: not by changing how transistors are fabricated, but by processing more complex packages across larger rectangular surfaces. Its promise comes from improved area utilization, higher potential throughput, and compatibility with heterogeneous integration.

The remaining question is manufacturability. Warpage, die placement, process uniformity, equipment standards, and yield will determine whether PLP can deliver lower cost at high volume. If those challenges are solved consistently, panels could become an important second manufacturing format alongside wafers—particularly as semiconductor value moves increasingly from individual dies to tightly integrated multi-chip systems.

## References

1. **SEMI — SEMI 3D20: Specification for Panel Characteristics for Panel Level Packaging Applications**  
    [View the SEMI 3D20 standard overview](https://store-dev2.semi.org/en-nl/products/3d02000-semi-3d20-en-specification-for-panel-characteristics-for-panel-level-packaging-plp-applications)
    
2. **SEMI — SEMI E181: Specification for Panel FOUP for Panel Level Packaging**  
    [View the SEMI E181 standard overview](https://store-us.semi.org/products/e18100-semi-e181-specification-for-panel-foup-for-panel-level-packaging)
    
3. **Fraunhofer IZM — Fan-Out Wafer and Panel Level Packaging: A Versatile Platform for Next-Generation 2D and 2.5D Packaging Solutions**  
    [Read the Fraunhofer IZM overview](https://www.izm.fraunhofer.de/en/news_events/trainings-and-workshops/advanced-substrates-beyond-pcb/fan-out-wafer-and-panel-level-packaging.html)
    
4. **Fraunhofer IZM — Panel Level Consortium 2.0**  
    [Explore Fraunhofer IZM's panel-level packaging research](https://www.izm.fraunhofer.de/en/institut/netzwerk_weltweit/panel-level-consortium-2-0.html)
    
5. **NIST / CHIPS for America — Arizona State University Advanced Packaging Award**  
    [Read the NIST project overview](https://www.nist.gov/chips/arizona-state-university-tempe)
    
6. **IEEE Electronics Packaging Society — Heterogeneous Integration Roadmap: Wafer-Level Packaging**  
    [Read the IEEE roadmap chapter](https://eps.ieee.org/images/files/HIR_2021/ch23-wlpfinal2.pdf)
    