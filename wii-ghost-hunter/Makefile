#---------------------------------------------------------------------------------
# Ghost Hunter - Wii homebrew. Requires devkitPro (devkitPPC + libogc + wiiuse).
#   make        -> builds ghost-hunter.dol
#---------------------------------------------------------------------------------
.SUFFIXES:
ifeq ($(strip $(DEVKITPPC)),)
$(error "Please set DEVKITPPC in your environment. export DEVKITPPC=<path to>devkitPPC")
endif

include $(DEVKITPPC)/wii_rules

TARGET   := ghost-hunter
BUILD    := build
SOURCES  := source
INCLUDES :=

CFLAGS   = -g -O2 -Wall $(MACHDEP) $(INCLUDE)
LDFLAGS  = -g $(MACHDEP) -Wl,-Map,$(notdir $@).map
LIBS     := -lwiiuse -lbte -logc -lm
LIBDIRS  := $(PORTLIBS)

ifneq ($(BUILD),$(notdir $(CURDIR)))
export OUTPUT   := $(CURDIR)/$(TARGET)
export VPATH    := $(foreach dir,$(SOURCES),$(CURDIR)/$(dir))
export DEPSDIR  := $(CURDIR)/$(BUILD)
export CC       := $(PREFIX)gcc
export LD       := $(CC)
export OFILES   := $(foreach f,$(notdir $(wildcard $(SOURCES)/*.c)),$(f:.c=.o))
export LIBPATHS := $(foreach dir,$(LIBDIRS),-L$(dir)/lib) -L$(LIBOGC_LIB)
export INCLUDE  := $(foreach dir,$(LIBDIRS),-I$(dir)/include) -I$(LIBOGC_INC) -I$(CURDIR)/$(BUILD)

.PHONY: $(BUILD) clean
$(BUILD):
	@[ -d $@ ] || mkdir -p $@
	@$(MAKE) --no-print-directory -C $(BUILD) -f $(CURDIR)/Makefile

clean:
	rm -rf $(BUILD) $(OUTPUT).elf $(OUTPUT).dol
else
DEPENDS := $(OFILES:.o=.d)
$(OUTPUT).dol: $(OUTPUT).elf
$(OUTPUT).elf: $(OFILES)
-include $(DEPENDS)
endif
