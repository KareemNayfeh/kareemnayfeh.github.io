# Passive Magnetic Springs: Source Reference for a Blog Post

## How to use this file

This is a technical source reference, not a finished blog post. It converts a 32-page slide presentation into readable Markdown, including information that was embedded in images and missed by PDF text extraction. Page numbers below refer to PDF pages, counting the title page as page 1. The accompanying `slides/page-01.png` through `slides/page-32.png` preserve all original figures; `original-presentation.pdf` preserves the source. Relative image links work when the complete folder is retained.

For a one-file workflow, this Markdown contains the principal content, equations, figure interpretations, and caveats. For maximum fidelity, use the complete folder and inspect the linked slide images when writing about a particular figure. This conversion is not a substitute for raw experimental data or a complete mathematical derivation. Approximate readings of plots are explicitly identified.

## Instructions for Codex when drafting the blog

- Use this reference as the primary source. Organize the article around the engineering problem, method, findings, and limitations rather than reproducing slide bullets.
- Match the existing project's blog format, frontmatter, typography, equation support, and content conventions. Inspect existing posts before creating one.
- Explain passive magnetic springs, gravity compensation, and the energy method in accessible engineering language. Introduce symbols before using equations.
- Distinguish predictions from experiments and approximate plot readings from stated numerical values. Do not invent data points, measurement uncertainty, simulation settings, citations, or error percentages.
- Attribute the work to the listed authors. Do not assume the project owner is one of those authors or infer their personal contributions. Use third person unless the user supplies an author identity and contribution details.
- Do not describe the device as generating free energy, having perfectly constant force, having zero hysteresis, or being stable in every direction.
- Treat each reported force ratio and sizing guideline as specific to the configurations and assumptions discussed. Do not generalize the one-third wall-thickness rule to arbitrary magnets and steels.
- Keep incomplete literature references incomplete or verify them separately before constructing a bibliography. Do not fabricate titles, DOI links, or publication venues.
- Any additional theory should be clearly distinguished from the presentation's reported findings. Where the slides omit a definition or derivation, acknowledge that omission.
- Use original slide images as reference material. If making new explanatory diagrams, label them as schematic; do not fabricate experimental plots. Preserve attribution for third-party figures.

## Source and attribution

**Title:** A Survey of Passive Magnetic Springs  
**Event:** 40th ASPE Annual Meeting, San Diego, California  
**Date printed on title slide:** November 5, 2025

| Author | Affiliation shown |
|---|---|
| Justin M. Verdirame | Physical Precision LLC |
| Byron Seaberg | MIT Precision Motion Control Lab |
| Yoonsik Kwon | MIT Precision Motion Control Lab |
| Kareem S. Nayfeh | George Mason University |
| David L. Trumper | MIT Precision Motion Control Lab |
| Samir A. Nayfeh | Physical Precision LLC |

Source footer websites: `www.phyon.tech` and `pmc.mit.edu`. These are transcribed source metadata, not independently verified references.

## Main story and findings

The presentation asks how to design useful passive magnetic springs with tractable formulas and modest computational effort before resorting to full 3D finite-element analysis (FEA). A central example is a long permanent magnet partly inserted into a soft magnetic tube. As overlap changes, cross-sectional regions with different magnetic energies replace one another. Their energy difference per unit length provides an approximate axial force.

This yields nearly constant force over a finite intermediate travel range. The force changes near the ends, and off-axis displacement can produce destabilizing lateral attraction. Iron improves force for a given magnet cross section but introduces saturation and hysteresis. Ironless layouts can recover comparable force by using larger magnets within a comparable overall envelope in the examples studied.

The presentation combines analytical magnetic circuits, 2D field calculations, 3D FEA comparisons, and a physical cylindrical-magnet experiment. The experiment's 2D prediction is about 11 N; the measured plateau is roughly 10 N by visual reading. The reported hysteresis loop is about 60 mN, less than 1%. These are distinct observations, not a claim of less than 1% model error.

## Notation and units

| Symbol | Meaning in this presentation | Units / caution |
|---|---|---|
| B | Magnetic flux density | T |
| H | Magnetic field intensity | A/m |
| B_r | Remanent flux density | T; also rendered B_R in figures |
| H_c | Coercive field magnitude | A/m |
| mu_0 | Free-space permeability | Approximately 4*pi*10^-7 H/m |
| mu_r | Relative permeability | Dimensionless; magnet recoil permeability in the energy formulas |
| mu | Absolute permeability | mu_r*mu_0 |
| E_0, E_1, E_2 | Magnetic energy per unit axial length in different cross-sectional regions | J/m, dimensionally equivalent to N; not total energy |
| E* | Reference magnetic energy per unit length / force scale | J/m or N; geometry-dependent |
| F | Axial force | N; sign follows the configuration's convention |
| t | Rectangular magnet thickness along the poling direction in the tube model | m when evaluating SI formulas |
| w | Rectangular magnet width perpendicular to that direction | m |
| g | One-sided air gap in the rectangular/circular tube models | m; two opposite gaps total 2g |
| a | Tube wall thickness | m |
| d | Circular magnet diameter | m |
| u | Displacement | Geometry-dependent direction |
| R or r | Radius notation in the axial-magnet slides | Slide drawings use R while some axes use r; confirm before calculations |

Symbols are local to each diagram. In particular, do not transfer the definition of `t`, `g`, or `E*` between unrelated geometries without checking the original slide.

## Slide-by-slide technical reference

### Pages 1-3: Motivation and applications

Page 1 contains the attribution above. Page 2 asks for useful design formulas addressing force, stiffness, travel, repeatability, low hysteresis, damping, parasitic forces and stiffness, temperature effects, and packaging. Design choices include magnet size, iron versus ironless constructions, Halbach arrangements, aspect ratio, and gap. A Linmot MagSpring product image illustrates an existing concept; it is not identified as the team's prototype.

Page 3 lists gravity compensation (reduced energy consumption and actuator size), vibration isolation including quasi-zero-stiffness springs, and non-contact operation relevant to wear, friction, and cleanliness. Hysteresis and eddy currents remain possible damping mechanisms. Mechanical springs and pneumatics are alternatives.

### Pages 4-5: Configuration and modeling survey

Normal configurations change separation across facing surfaces; shear configurations change overlap through relative motion along the interacting surfaces. Torsional springs and actuators incorporating gravity compensation are also discussed. Variations include arrays, iron, ironless designs, and Halbach arrangements.

Modeling approaches: analytical magnet-pair formulas; equivalent magnetic charge or current; Fourier harmonic models; lumped magnetic circuits; 2D FEA (FEMM is identified by the presentation as free/open source); 3D FEA; and semi-analytical combinations.

Magnetic circuit analogy: reluctance corresponds to resistance, magnetomotive force (MMF) to voltage, and magnetic flux to current. Equivalent-charge/current illustration credited to Lahdo et al. 2017.

### Pages 6-7: Magnetic materials and energy

The figures contrast air/vacuum's linear B-H response, soft iron's nonlinear hysteresis loop, and a permanent magnet's remanence and demagnetization curve. The magnet's approximately linear recoil relation is:

```text
B = B_r + mu*H
mu_r = mu/mu_0
```

For air/vacuum, `B = mu_0*H`. For a general linear medium the relation is `B = mu*H`; the slide's air/vacuum equation should not be generalized to every material. Page 7 shades magnetic energy areas on the B-H diagrams. These areas represent energy density (J/m^3), distinct from E_i (J/m).

### Page 8: Shape and demagnetization

Magnetic behavior depends on shape. A sourced illustration from `www.mriquestions.com` compares demagnetization factors for cylinders, plates, ellipsoids, a cube, and a sphere. A separate plot shows rectangular-section `E_0/E*` increasing from approximately 0.50 to 0.77 as `w/t` increases from 1 to 4 (visual readings, not tabulated data).

The slide prints `B_0 = N B_ext` but does not fully define the symbols or establish a general demagnetization law. Do not use that isolated expression as a universal design formula; the reliable takeaway here is shape dependence.

### Pages 9-10: Magnet in an iron tube and the energy method

The rectangular magnet is poled across thickness t and moves axially into the tube. For a sufficiently long magnet and tube, the field can be approximated using three cross-sectional regions: empty tube, magnet inside tube, and magnet outside tube. The diagrams show magnetic-circuit and 2D field representations.

Define each E as magnetic energy per unit thickness of an axial slice. The approximate axial force magnitude for the indicated insertion direction is:

```text
F ≈ E_0 - E_1
```

The circuit approximation for the air-gap flux density is:

```text
B = B_r * (t/mu_r) / (t/mu_r + 2*g)
```

It treats the iron path as sufficiently permeable; saturated/thin iron requires a more complete calculation. E_0 can come from a handbook expression or 2D FEA. The normalization is:

```text
E* = B_r^2 * t*w / (2*mu_r*mu_0)
```

The illustrated case gives `E* = 101 J/m`, `E_1 = 0.09 E* = 9.1 J/m`, and `E_0 = 0.55 E* = 56 J/m`. Their rounded difference is about 47 N, a derived estimate rather than an additional measurement.

Explanatory interpretation: if a displacement du replaces one slice with another, the energy changes by a quantity proportional to `(E_0 - E_1)*du`. Force follows from the change of energy with displacement. Do not insert an extra magnet length into the force equation: these E values are already per unit length.

### Pages 11-12: 3D comparison and iron saturation

Page 11 compares a nearly flat force estimate near `F/E* ≈ 0.45` with a 3D FEA curve over insertion displacement. The numerical curve has entrance and exit effects. Agreement is best in the intermediate region; it is not uniform over all travel.

Page 12 shows that thinning the iron produces saturation and lowers the plateau (approximately 0.35 in the illustrated comparison). The same energy method can still be used, but E_1 should come from 2D FEA rather than the simple circuit formula. Field plots show localized high flux density.

### Page 13: Air gap and wall thickness

For N52 magnets and 1018 steel in the studied rectangular configuration, a wall thickness about one-third of magnet width suffices. The graph plots F/E* against a/w for `2g/t = 0.1, 0.2, 0.3`. Force increases with wall thickness and approaches a plateau; larger gaps lower force. This is a configuration-specific rule of thumb.

### Page 14: Rectangular lateral negative stiffness

Lateral displacement attracts the magnet toward the tube wall. Negative stiffness is much larger parallel to the poling direction than transverse to it in this example. The example specifies an N52 magnet, a 1018 tube, `w = 12 mm`, `t = 10 mm`, and `a = 6 mm`.

The left plot gives lateral force per millimeter of insertion versus lateral offset. The right plot gives lateral negative stiffness per millimeter of insertion versus `2g/t`. Do not quote these normalized plot values as the total device force or stiffness. Larger gaps reduce the destabilizing stiffness. A useful blog explanation is that nearly constant axial force does not imply lateral self-centering.

### Pages 15-18: Split magnets, reversed polarization, and ironless designs

Splitting the cross section into a moving central piece and stationary side pieces reduces moving mass. In the depicted geometry, the central piece has thickness t/2 and the side pieces t/4 each. The energy expression becomes:

```text
F = E_0 - (E_1 - E_2)
```

E_2 accounts for the remaining stationary assembly's cross section, as shown in the diagrams. Reported rounded examples:

| Page | Configuration | E_0 (J/m) | E_1 (J/m) | E_2 (J/m) | Reported F |
|---|---|---:|---:|---:|---:|
| 15 | Split magnet, iron tube, attraction | 35 | 9.6 | 24 | 50 N |
| 16 | Split magnet, iron tube, central polarization reversed | 35 | 83 | 24 | -23 N |
| 17 | Ironless, attraction | 35 | 58 | 39 | 16 N |
| 18 | Ironless, central polarization reversed | 35 | 88 | 39 | -14 N |

Use the reported force values as approximate. The rounded entries on page 16 produce -24 N rather than the printed -23 N; do not silently present them as an exact equality. The negative signs denote repulsion under the slides' convention.

Page 15 says attraction is approximately preserved after splitting. Page 16 says repulsion is about half that attractive magnitude for the iron-backed case. Page 17 says removing iron eliminates a large source of hysteresis and reduces force to roughly one-third for that magnet geometry; enlarging the magnets to occupy the overall iron-backed envelope can recover similar force. Page 18 says the ironless repulsive case is only slightly weaker than its attractive counterpart.

### Pages 19-20: Comparisons and packaging

Page 19 overlays semi-analytical estimates and displacement-dependent 3D FEA curves for several constructions. Their plateaus differ; all show end effects. The original figure is the authority for curve-to-geometry mapping.

Page 20 specifies `2g/t = 0.1` (use this ratio rather than the slide's looser verbal description of the gap). With `a = w/3`, the iron-backed design yields approximately `F = 0.45 E*` and overall width about `1.7w`. A three-magnet ironless design with the same air gap yields about `0.15 E*` for the comparison given.

Because E* scales with total magnet cross-sectional area, tripling magnet area can compensate for that factor of three in force. Similar scaling of both linear dimensions gives `sqrt(3) ≈ 1.7`. The drawing compares three approximately equal-force designs. This is a packaging comparison, not a claim that ironless designs always have identical size, mass, cost, or stiffness.

### Pages 21-22: Circular tube and diametrically poled magnet

A diametrically poled cylindrical magnet is magnetized across its diameter, not along its length. For diameter d:

```text
E* = pi*d^2*B_r^2 / (8*mu_r*mu_0)
E_0/E* = 1/2
F = E_0 - E_1
```

E_1/E* comes from 2D FEA. The normalized axial force falls as `2g/d` increases. Page 22 gives the circular counterpart of the wall guideline: for N52 and 1018 steel, tube thickness about one-third of magnet diameter suffices in the studied cases. Curves shown are `2g/d = 0.1` and `0.25`.

### Page 23: Circular lateral negative stiffness

Lateral offset causes attraction toward the circular tube wall. Unlike the rectangular example, the presentation reports equal attraction for displacement in the poling and transverse directions. The left example uses a 6.35 mm magnet in an 8 mm-ID tube; the right varies tube ID for a 6.35 mm magnet. Forces and stiffness are normalized per millimeter of insertion. Increasing gap reduces negative stiffness.

### Page 24: Experiment and model comparison

| Component / quantity | Value stated on slide |
|---|---|
| Magnet | N52, 6.35 mm OD, 25.4 mm long |
| Tube | 1018 steel, 7 mm ID, 16 mm OD, 25 mm long |
| Magnet connection | Aluminum rod glued to magnet |
| Positioning | Manual aluminum crossed-roller stage |
| Force-sensing arrangement | Compound flexure stage with capacitive gauge directly below tube |
| Reference energy scale | E* ≈ 26 J/m |
| Gap divided by magnet radius | About 0.1 |
| 2D prediction | F ≈ 0.42 E* ≈ 11 N |

Derived from the listed diameters, the radial clearance is `(7 - 6.35)/2 = 0.325 mm`, giving `2g/d ≈ 0.102`. This arithmetic is added explanation, not an independent measurement.

The plot compares measurement (blue), 3D FEA (orange), and a constant 2D estimate (yellow dotted). Visually, measurement reaches roughly 10 N and gradually declines; 3D FEA reaches roughly 11 N and also rolls off near the end. Do not claim exact experimental agreement or report a numerical validation error from this plot without digitizing or obtaining raw data.

### Page 25: Measured hysteresis

The iron tube exhibits some hysteresis. Cycling the magnet back and forth over several millimeters produces a force loop of about 60 mN, reported as less than 1%. The zoomed graph spans about 5-9 mm insertion and shows a change in force, not total axial force. Do not confuse the loop width with the simulation-to-measurement discrepancy.

### Pages 26-27: Moderate-travel shear arrangements

The diagrams compare M1 and M2 magnet contributions, their sum, and an alternative M3 arrangement. A single magnet can provide nearly constant force over a moderate travel range. A coil can be packaged with the assembly to add active actuation; Choi et al. 2009 is cited as an example.

The plots use dimensionless force F/E* and displacement u in millimeters. Page 27's M3 curve illustrates a comparatively flat positive-force region. The slides do not provide a full optimized actuator design or control implementation.

### Pages 28-29: Fourier-series model of magnet arrays

The model represents periodic magnet configurations using spatial harmonics. The iron backing is idealized with permeability tending to infinity. Two scalar-potential regions satisfy Laplace's equation, `∇²ψ = 0`. The moving permanent magnet is represented by magnetic charge density:

```text
sigma_m(y, y_r) = sum_{k=1..infinity} [a_k(y_r)*cos(p*k*y) + b_k(y_r)*sin(p*k*y)]
p = 2*pi/lambda_u
```

Here y_r is relative displacement, lambda_u is the spatial period, k the harmonic number, D_f the out-of-plane depth, and H_y1(y,z_m1) the fixed-magnet-driven field intensity evaluated at z_m1. The slide prints:

```text
F_m(y_r) = D_f * integral_0^lambda_u [sigma_m(y,y_r)*H_y1(y,z_m1)] dy

         = (mu_0*D_f*lambda_u/2) * sum_{k=1..infinity}
           a_k(y_r) * { [1-cosh(p*k*(z_2-z_s1))]*A_k
                        + sinh(p*k*(z_2-z_s1))*B_k }
                     / sinh(p*k*z_2)
```

This is a transcription, not an independently validated derivation. The slides do not fully define A_k, B_k, their boundary-condition calculation, or the magnetic-charge normalization. In particular, do not silently resolve unit conventions from the integral and expanded form without the underlying derivation. For a general blog, the harmonic concept and reported performance are more useful than presenting this as a ready-to-code solver.

The illustrated case labels a 20 mm period (lambda_pp on page 29), 5 mm magnet thicknesses, and a 0.5 mm gap. The plotted displacement response is approximately sinusoidal over 0-20 mm. Its vertical-axis labeling is not reliably readable, so do not quote an absolute force amplitude from it. The slide states that the first harmonic is accurate to within a few percent for the example; it does not establish this for every array.

### Page 30: Normal force between axially poled magnets

The configuration is a coaxial pair magnetized along the axis. For tall magnets (`t/R >> 1`), the sticking/contact force approaches E* according to the slide. Reversing one magnet produces repulsion with nearly the same magnitude. The plot compares `t/R = 0.2, 0.5, 1.0, 2.0`; force decreases as separation increases.

The page does not restate the reference E* formula for this arrangement. The diagram labels R, while the axis uses u/r. Avoid building a numerical calculator from this slide without confirming radius and normalization conventions.

### Page 31: Push-pull normal springs

Three magnets with `t/R = 0.5` form a push-pull arrangement: one interaction attracts while the other repels. The force-displacement curve is relatively flat near the middle of travel. The slide reports that small gaps and travels can attain `F/E* ≈ 0.9`. Plotted gap ratios are `g/r = 0.2, 0.6, 1.0`. The smallest gap yields the highest normalized force and a narrower available travel range. This is not a 90% energy efficiency claim.

### Page 32: Conclusions and open work

The presentation concludes that E* provides an approximate upper-bound scale, changes in magnetic energy provide a useful route to force, and 2D FEA can exploit planar geometry and symmetry.

Listed next steps are design guidelines for stiffness and parasitic forces, misalignment, temperature variation, Halbach magnets, iron versus ironless designs, hysteresis estimates, and adding an actuator. These are future directions, not all completed results.

## Literature mentions as printed (not a verified bibliography)

| Topic | Names / years provided |
|---|---|
| Normal configurations | JLG Janssen 2013; Zhang et al. 2023 |
| Shear configurations | JLG Janssen 2011; Berkhof 2015 |
| Torsional configurations | Boisclair and Richard 2017; Kozakiewicz and Winiarski 2023; Mrak et al. 2019 |
| Gravity-compensated actuators | Wang 2015; Deng 2017; Westhoff and Maas 2024; Jansen 2007 |
| Optimization | Mrak 2022; Zhang et al. 2019; Robertson 2011; Hol 2004 |
| Surveys | Zhu and Chai 2024; Zhou and Wu 2022 |
| Equivalent charge/current figure | Lahdo et al. 2017 |
| Moderate-travel actuator example | Choi et al. 2009 |
| Fourier methods | Jansen 2007; Cho and Jun 2002; Cho et al. 2001; Trumper et al. 1996 |

The source uses both Janssen and Jansen; do not assume they are interchangeable spellings. Full titles, venues, and identifiers were not provided.

## Suggested blog structure (editorial suggestion)

1. Open with the problem of supporting a load without making an actuator continuously carry its weight.
2. Explain why a useful magnetic spring needs a controlled force-displacement relationship.
3. Introduce the tube-and-magnet example and the energy-per-length method.
4. Explain why simple models work in the middle of travel but need help near ends and in saturated iron.
5. Compare iron-backed and ironless layouts, emphasizing packaging, moving mass, and hysteresis tradeoffs.
6. Present the cylindrical prototype and distinguish its predictions, measurements, and hysteresis.
7. Discuss lateral instability and the need to account for parasitic forces.
8. Briefly broaden to Fourier array models and push-pull axial arrangements.
9. Close with the design approach and the questions the presentation leaves open.

Suggested headline: **Designing Passive Magnetic Springs with Energy-Based Models**.

## Visual source index

The complete package contains a full-page PNG for every slide. Prefer inspecting these originals over reconstructing curve data from text.

- [Page 01](slides/page-01.png)
- [Page 02](slides/page-02.png)
- [Page 03](slides/page-03.png)
- [Page 04](slides/page-04.png)
- [Page 05](slides/page-05.png)
- [Page 06](slides/page-06.png)
- [Page 07](slides/page-07.png)
- [Page 08](slides/page-08.png)
- [Page 09](slides/page-09.png)
- [Page 10](slides/page-10.png)
- [Page 11](slides/page-11.png)
- [Page 12](slides/page-12.png)
- [Page 13](slides/page-13.png)
- [Page 14](slides/page-14.png)
- [Page 15](slides/page-15.png)
- [Page 16](slides/page-16.png)
- [Page 17](slides/page-17.png)
- [Page 18](slides/page-18.png)
- [Page 19](slides/page-19.png)
- [Page 20](slides/page-20.png)
- [Page 21](slides/page-21.png)
- [Page 22](slides/page-22.png)
- [Page 23](slides/page-23.png)
- [Page 24](slides/page-24.png)
- [Page 25](slides/page-25.png)
- [Page 26](slides/page-26.png)
- [Page 27](slides/page-27.png)
- [Page 28](slides/page-28.png)
- [Page 29](slides/page-29.png)
- [Page 30](slides/page-30.png)
- [Page 31](slides/page-31.png)
- [Page 32](slides/page-32.png)
