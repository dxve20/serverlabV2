/* ServerLab data: lesson steps, quiz, badges, levels. No DOM here so it can be tested in Node. */
const SL = {};

SL.PASS = 60; // assessment pass mark in percent

SL.LANGS = ['English (United States)', 'English (United Kingdom)', 'Chinese (Traditional)', 'Japanese', 'Spanish (Spain)'];
SL.TIMES = ['English (United States)', 'English (Philippines)', 'English (United Kingdom)', 'Chinese (Traditional, Taiwan)'];
SL.KBS = ['US', 'United Kingdom', 'Chinese (Traditional) - US Keyboard', 'Japanese'];

SL.EDITIONS = [
  { name: 'Windows Server 2019 Standard', desc: 'This option installs Server Core. There is no desktop; you manage the server with a command prompt or remotely.' },
  { name: 'Windows Server 2019 Standard (Desktop Experience)', desc: 'This option installs the full graphical interface, including Server Manager. Use it for a server you will manage with the mouse.' },
  { name: 'Windows Server 2019 Datacenter', desc: 'This option installs Server Core with Datacenter licensing, built for heavily virtualised servers. There is no desktop.' },
  { name: 'Windows Server 2019 Datacenter (Desktop Experience)', desc: 'This option installs the full graphical interface with Datacenter licensing, built for heavily virtualised servers.' },
];

SL.UNITS = {
  coc3: {
    id: 'coc3',
    tag: 'COC 3 · LESSON 1',
    title: 'Install Windows Server 2019',
    shortTitle: 'COC 3 · Install Windows Server 2019',
    desc: 'Boot the installer, pick the right edition, partition the disk and finish first sign-in. 13 steps, no loading screens.',
    steps: [
      { id: 'boot', title: 'Boot from the installation media', short: 'Boot from the CD/DVD with the Windows Server 2019 ISO',
        goal: 'Start the installer. Boot the VM from the Windows Server 2019 media.',
        hint: 'Pick the CD/DVD drive. It is the one that mentions Windows Server 2019.',
        ok: 'The installer lives on the CD/DVD (the ISO), so that is the device to boot from.' },
      { id: 'language', title: 'Language, time and keyboard', short: 'Keep English (United States) and the US keyboard, then Next',
        goal: 'Check the three language settings match the lab, then click Next.',
        hint: 'Language and Time are English (United States). Keyboard is US. Then press Next.',
        ok: 'These defaults match the lab manual, and a US keyboard keeps symbols in the right place for passwords.' },
      { id: 'install', title: 'Install now', short: 'Click Install now',
        goal: 'Start a new installation.',
        hint: 'Click the big Install now button in the middle of the window.',
        ok: 'Install now starts a fresh installation. Repair is only for a Windows that already exists.' },
      { id: 'edition', title: 'Choose the edition', short: 'Pick Standard (Desktop Experience) for the full GUI',
        goal: 'Choose the edition that gives you the full graphical interface.',
        hint: 'Select "Windows Server 2019 Standard (Desktop Experience)" and press Next.',
        ok: 'Desktop Experience gives you the GUI and Server Manager. Without it you get Server Core.' },
      { id: 'license', title: 'Accept the license terms', short: 'Tick "I accept the license terms", then Next',
        goal: 'Accept the license terms so Setup lets you continue.',
        hint: 'Tick the check box at the bottom. Next only works after that.',
        ok: 'Setup cannot continue until the license terms are accepted.' },
      { id: 'type', title: 'Choose the installation type', short: 'Choose Custom: Install Windows only (advanced)',
        goal: 'Pick the installation type for a blank disk.',
        hint: 'Choose "Custom: Install Windows only (advanced)".',
        ok: 'Custom is the right type for a blank disk. Upgrade needs an older Windows to upgrade.' },
      { id: 'disk1', title: 'Select the free space and click New', short: 'Select Unallocated Space, click New',
        goal: 'Prepare the disk. Select the unallocated space and click New.',
        hint: 'Click the row "Drive 0 Unallocated Space", then click New under the list.',
        ok: 'New creates a partition from the unallocated space.' },
      { id: 'disk2', title: 'Set the size and Apply', short: 'Use the full 60 GB, click Apply, then OK',
        goal: 'Keep the full size (61440 MB) and click Apply. Confirm the extra partitions message.',
        hint: 'Leave the size as it is, click Apply, then click OK on the message.',
        ok: 'Using the whole disk leaves room for updates. Setup also adds a small System Reserved partition for boot files.' },
      { id: 'disk3', title: 'Pick the partition and Next', short: 'Select Partition 2 (Primary), click Next',
        goal: 'Choose where Windows goes. Select the big Primary partition and click Next.',
        hint: 'Select "Drive 0 Partition 2" (the large one), then click Next.',
        ok: 'Windows goes on the large Primary partition. System Reserved only holds boot files.' },
      { id: 'install2', title: 'Installing Windows (fast-forward)', short: 'Fast-forward through the file copy and restarts',
        goal: 'Setup copies files and restarts the server. Skip the wait with Fast-forward.',
        hint: 'Click the glowing Fast-forward button above the screen.',
        ok: 'In real life this takes a while and the server restarts on its own. The simulator skips it.' },
      { id: 'password', title: 'Set the Administrator password', short: 'Type a strong password twice, click Finish',
        goal: 'Create the Administrator password: 8+ characters, 3 of 4 character types. Type it twice.',
        hint: 'Try something like Server2019 in both boxes, then click Finish.',
        ok: 'A complex password protects the built-in Administrator account.' },
      { id: 'signin', title: 'Ctrl+Alt+Delete and sign in', short: 'Send Ctrl+Alt+Del, sign in as Administrator',
        goal: 'Unlock the sign-in screen with Ctrl+Alt+Delete, then sign in as Administrator.',
        hint: 'Click Ctrl+Alt+Del above the screen, then type the password you set in the last step.',
        ok: 'Windows Server asks for Ctrl+Alt+Delete before sign-in, then checks your password.' },
      { id: 'sm', title: 'Find the computer name in Server Manager', short: 'Server Manager > Local Server > Computer name',
        goal: 'Server Manager opens by itself. Open Local Server and find the Computer name.',
        hint: 'Click Local Server in the left list, then click the Computer name row.',
        ok: 'Local Server shows the computer name, workgroup and other basic settings of this server.' },
    ],
    quiz: [
      { q: 'Which boot device starts the Windows Server 2019 installer from an ISO?', a: ['CD/DVD drive with the Windows Server 2019 media', 'The empty hard disk', 'Network (PXE) boot with no server', 'The USB keyboard'], why: 'The installer is on the media. An empty disk has nothing to boot, and PXE needs a deployment server.' },
      { q: 'Which edition gives you the full graphical interface?', a: ['Windows Server 2019 Standard (Desktop Experience)', 'Windows Server 2019 Standard', 'Windows Server 2019 Datacenter', 'Repair your computer'], why: 'Only the editions labelled Desktop Experience include the GUI. The others install Server Core.' },
      { q: 'You are installing onto an empty disk. Which install type do you choose?', a: ['Custom: Install Windows only (advanced)', 'Upgrade: Install Windows and keep files, settings, and applications', 'Repair your computer', 'Load a storage driver and restart'], why: 'On an empty disk there is nothing to keep, so Custom is the one that works.' },
      { q: 'What must you do before Next works on the license terms screen?', a: ['Tick "I accept the license terms"', 'Restart the virtual machine', 'Type the product key twice', 'Delete the System Reserved partition'], why: 'Next stays disabled until the license terms are accepted.' },
      { q: 'About how much disk space does the lab say a Windows Server 2019 partition needs at minimum?', a: ['32 GB', '8 GB', '10 GB', '16 GB'], why: 'The system requirement used in this lab is 32 GB. This is why we use the whole 60 GB disk.' },
      { q: 'On the partition screen, where do you install Windows?', a: ['On the large Primary partition (Partition 2)', 'On the small System Reserved partition', 'On both partitions at once', 'Nowhere: delete everything and click Next'], why: 'System Reserved is a small partition for boot files. The Primary partition is where Windows goes.' },
      { q: 'Which password follows the lab rule (8+ characters, 3 of 4 character types)?', a: ['Server2019', 'p@ssword', 'ABCDEFGH', 'Ab1'], why: 'Server2019 has uppercase, lowercase and numbers. "p@ssword" has only two types, "ABCDEFGH" one, and "Ab1" is too short.' },
      { q: 'How do you unlock the Windows Server sign-in screen?', a: ['Press Ctrl+Alt+Delete', 'Press Windows+L', 'Press Alt+F4', 'Press Ctrl+Shift+Esc'], why: 'Windows Server asks for Ctrl+Alt+Delete first. In a VM you send it from the toolbar.' },
      { q: 'Which Server Manager page shows the computer name and workgroup?', a: ['Local Server', 'Dashboard', 'All Servers', 'File and Storage Services'], why: 'Local Server lists the properties of the machine you are on, including the computer name.' },
      { q: 'Which account do you set the password for on the Customize settings page?', a: ['Administrator', 'Guest', 'DefaultAccount', 'SYSTEM'], why: 'Setup asks for the built-in Administrator password, which you then use to sign in.' },
    ],
  },
  coc4: {
    id: 'coc4',
    tag: 'COC 4 · LESSON 1',
    title: 'Maintain & Repair Systems and Networks',
    shortTitle: 'COC 4 · Maintain & Repair Systems & Networks',
    desc: 'Apply OHS & ESD safety, inspect Layer 1 cabling, diagnose IP/DHCP faults in Command Prompt, verify connectivity, and complete 5S.',
    steps: [
      { id: 'c4_ohs', title: 'Equip ESD protection (OHS)', short: 'Put on the anti-static wrist strap before inspecting hardware',
        goal: 'A workstation lost network access after being moved. Equip the proper ESD protection before touching hardware.',
        hint: 'Click the Anti-static wrist strap in the technician toolkit.',
        ok: 'Ground yourself with an anti-static wrist strap to prevent Electrostatic Discharge (ESD) from damaging internal parts.' },
      { id: 'c4_phys', title: 'Inspect physical layer (Layer 1)', short: 'Reseat the loose RJ45 Ethernet patch cable on the NIC',
        goal: 'Check the rear I/O panel. The NIC link LED is dark—find and fix the physical connection fault.',
        hint: 'The RJ45 Ethernet cable is partially unplugged. Click it to snap it firmly into the port.',
        ok: 'Always verify Layer 1 (cables and link LEDs) first. The green link LED is now lit.' },
      { id: 'c4_ipconfig', title: 'Inspect IP configuration', short: 'Run ipconfig /all in Command Prompt',
        goal: 'The PC still has no internet. Open Command Prompt and inspect the adapter IPv4 settings.',
        hint: 'Type ipconfig /all and press Enter.',
        ok: 'The adapter has a 169.254.x.x APIPA address, meaning it failed to get an IP lease when the cable was loose.' },
      { id: 'c4_release', title: 'Release the invalid APIPA lease', short: 'Run ipconfig /release',
        goal: 'Clear the current invalid IP configuration before requesting a fresh one.',
        hint: 'Type ipconfig /release and press Enter.',
        ok: 'The old APIPA address has been cleared.' },
      { id: 'c4_renew', title: 'Renew the DHCP IP lease', short: 'Run ipconfig /renew',
        goal: 'Request a valid IPv4 address, subnet mask, and default gateway from the DHCP server.',
        hint: 'Type ipconfig /renew and press Enter.',
        ok: 'The workstation received a valid 192.168.1.105 address and 192.168.1.1 gateway.' },
      { id: 'c4_ping', title: 'Test gateway connectivity', short: 'Run ping 192.168.1.1',
        goal: 'Verify local network communication by pinging the default gateway.',
        hint: 'Type ping 192.168.1.1 and press Enter.',
        ok: '4 packets sent, 4 received (0% loss). Local LAN connectivity is restored.' },
      { id: 'c4_dns', title: 'Verify DNS and external access', short: 'Run ping google.com',
        goal: 'Confirm that DNS name resolution and internet routing are working properly.',
        hint: 'Type ping google.com and press Enter.',
        ok: 'DNS resolved the domain and replies returned cleanly.' },
      { id: 'c4_5s', title: 'Apply 5S and submit service report', short: 'Clear tools (5S) and sign off the maintenance report',
        goal: 'Complete Learning Outcome 5: organize your tools using 5S and submit the repair report.',
        hint: 'Click "Apply 5S Cleanup" first, then click "Submit Service Report".',
        ok: 'Proper 5S housekeeping and documentation complete the COC 4 maintenance and repair workflow.' },
    ],
    quiz: [
      { q: 'Which PPE protects computer components from Electrostatic Discharge (ESD) during maintenance?', a: ['Anti-static wrist strap', 'Cotton winter gloves', 'Dust mask only', 'Safety boots'], why: 'An anti-static wrist strap safely grounds static electricity from your body.' },
      { q: 'What is the very first layer you should check when a workstation loses network connectivity?', a: ['Physical layer (cables, NIC link LEDs, switch ports)', 'Reinstalling Windows Server', 'Editing the Windows Registry', 'Flashing the motherboard BIOS'], why: 'Checking physical cables and link lights first solves the most common faults immediately.' },
      { q: 'A Windows PC shows an IPv4 address of 169.254.44.10. What does this mean?', a: ['APIPA fallback because the PC could not reach a DHCP server', 'A valid public internet IP address', 'The hard drive is full', 'DNS is blocking all websites'], why: 'Windows assigns a 169.254.x.x APIPA address whenever DHCP discovery fails.' },
      { q: 'Which command displays the MAC address, DHCP status, DNS servers, and IPv4 lease details?', a: ['ipconfig /all', 'chkdsk /r', 'diskpart', 'format c:'], why: 'ipconfig /all prints full adapter details including physical (MAC) address, DHCP, and DNS.' },
      { q: 'Which sequence of commands refreshes a failed DHCP IP lease in Windows?', a: ['ipconfig /release followed by ipconfig /renew', 'ping 127.0.0.1 followed by exit', 'tracert followed by shutdown', 'netstat followed by cls'], why: 'Releasing drops the stale/APIPA address and renewing requests a valid lease from DHCP.' },
      { q: 'If ping 192.168.1.1 succeeds with 0% loss, what have you confirmed?', a: ['The PC can communicate with the local default gateway', 'The printer has enough ink', 'Windows updates are finished', 'The CMOS battery is new'], why: 'Pinging the default gateway tests end-to-end local LAN connectivity to the router.' },
      { q: 'If ping 192.168.1.1 works, but ping google.com fails with "could not find host", what is likely broken?', a: ['DNS name resolution', 'The power supply unit (PSU)', 'The monitor HDMI cable', 'The keyboard driver'], why: 'When IP connectivity works but domain names fail to resolve, DNS configuration is the culprit.' },
      { q: 'According to TESDA CSS COC 4, what must be done after testing and verifying a repaired system?', a: ['Apply 5S housekeeping and complete the maintenance/service report', 'Leave tools scattered on the bench for the next user', 'Delete all system logs', 'Disconnect the ground wire permanently'], why: 'Learning Outcome 5 requires final testing, 5S workplace organization, and proper documentation.' },
    ],
  },
};

/* Backward-compatible aliases pointing to COC 3 */
SL.STEPS = SL.UNITS.coc3.steps;
SL.QUIZ = SL.UNITS.coc3.quiz;

SL.BADGES = [
  { id: 'first_boot', code: '01', title: 'First boot', desc: 'Start the Windows Server installer for the first time.' },
  { id: 'right_edition', code: '02', title: 'Right edition', desc: 'Pick Desktop Experience on the first try.' },
  { id: 'clean_disk', code: '03', title: 'Clean disk', desc: 'Do all three disk steps with no mistakes and no hints.' },
  { id: 'no_hints', code: '04', title: 'No hints', desc: 'Finish a lesson without using a hint.' },
  { id: 'club60', code: '05', title: '60% club', desc: 'Pass an assessment.' },
  { id: 'full_marks', code: '06', title: 'Full marks', desc: 'Score 100% on an assessment.' },
  { id: 'esd_safe', code: '07', title: 'ESD safe', desc: 'Equip ESD protection on the first try in COC 4.' },
  { id: 'net_doctor', code: '08', title: 'Net doctor', desc: 'Fix the COC 4 network fault with zero mistakes.' },
  { id: 'clean_5s', code: '09', title: '5S certified', desc: 'Complete the COC 4 maintenance and 5S workflow.' },
];

SL.LEVELS = [
  { n: 1, name: 'Trainee', at: 0 },
  { n: 2, name: 'Operator', at: 80 },
  { n: 3, name: 'Rack tech', at: 200 },
  { n: 4, name: 'Sysadmin', at: 360 },
  { n: 5, name: 'Architect', at: 520 },
];

/* Sample classmates so the board is not empty when offline. Marked as samples in the UI. */
SL.SAMPLES = [
  { name: 'Jon Reyes', points: 540 }, { name: 'Aira Cruz', points: 420 }, { name: 'Paolo Diaz', points: 310 },
  { name: 'Lea Mendoza', points: 230 }, { name: 'Kyle Tan', points: 150 }, { name: 'Rica Gomez', points: 90 }, { name: 'Dan Ortiz', points: 45 },
];